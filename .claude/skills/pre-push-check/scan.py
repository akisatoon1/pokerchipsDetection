"""
まだ push していないコミットに, GitHub に上げてはいけないものが入っていないかを調べる.
後のコミットで消したものも push すれば履歴に残るので, 最新の状態ではなく範囲の全コミットを見る.

使い方: リポジトリのルートで
    python3 -I .claude/skills/pre-push-check/scan.py [範囲]
範囲を省くと, 追跡しているリモートのブランチ (なければ origin/<今のブランチ>) から HEAD までを見る.
出力: 見つけたものの一覧. [NG] は上げてはいけないもの, [要確認] は人が判断するもの.
終了コード: 何も見つからなければ 0, 見つかれば 1, 調べられなければ 2.
"""

import argparse
import io
import re
import subprocess
import sys
from dataclasses import dataclass

# これより大きいファイルは知らせる. GitHub は 50 MB で警告し, 100 MB で拒否する.
LARGE_FILE_BYTES = 5 * 1024 * 1024

# 出力に出す行の長さの上限. 圧縮した JS などの長い行で出力があふれないようにするため.
MAX_LINE_CHARS = 160

# 置いてはいけない場所と名前. (正規表現, 理由, 重さ).
PATH_RULES = [
    (r"(^|/)\.env(\.(?!example$|sample$)[^/]*)?$", "秘密情報 (.env)", "NG"),
    (r"(^|/)\.dev\.vars$", "wrangler の秘密情報 (.dev.vars)", "NG"),
    (r"\.(pem|key|p12|pfx|jks|keystore)$", "鍵や証明書", "NG"),
    (r"(^|/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$", "SSH の鍵", "NG"),
    (r"(^|/)local\.properties$", "手元の SDK のパス (Android)", "NG"),
    (r"(^|/)\.claude/settings\.local\.json$", "手元だけの Claude Code の設定", "NG"),
    (
        r"(^|/)(node_modules|\.wrangler|\.gradle|\.kotlin|\.cxx|\.venv|third_party|models)/",
        "外から取るものや作り直せるもの",
        "NG",
    ),
    (r"(^|/)(build|build-android|dist|captures)/", "ビルド結果", "NG"),
    (r"\.(onnx|pt|apk|aab|so|o|a|class|dex)$", "モデルやビルド結果", "NG"),
    (r"\.(sqlite|sqlite3|db)$", "DB の中身", "要確認"),
]

# 追加した行とコミットメッセージで探す文字列. (正規表現, 理由, 重さ).
TEXT_RULES = [
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "秘密鍵", "NG"),
    (r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}", "GitHub のトークン", "NG"),
    (r"\bsk-ant-[A-Za-z0-9_-]{20,}", "Anthropic の API キー", "NG"),
    (r"\bsk-(proj-)?[A-Za-z0-9]{32,}", "OpenAI などの API キー", "NG"),
    (r"\bAKIA[0-9A-Z]{16}\b", "AWS のアクセスキー", "NG"),
    (r"\bAIza[0-9A-Za-z_-]{35}\b", "Google の API キー", "NG"),
    (r"\bxox[abprs]-[A-Za-z0-9-]{10,}", "Slack のトークン", "NG"),
    (r"\b(CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_API_KEY)\s*[=:]\s*\S{8,}", "Cloudflare のトークン", "NG"),
    (
        r"(?i)\b(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\b[\"']?\s*[:=]\s*[\"'][^\"'\s]{12,}[\"']",
        "秘密情報らしい代入",
        "要確認",
    ),
    (r"\bBearer [A-Za-z0-9._~+/-]{20,}=*", "認証ヘッダーの値", "要確認"),
    (
        r"database_id\s*=\s*\"(?!00000000-0000-0000-0000-000000000000\")[0-9a-f-]{36}\"",
        "本番の D1 の id (wrangler.toml は仮の値にしておく決まり)",
        "要確認",
    ),
    (r"/(home|Users)/[A-Za-z0-9_.-]+/", "手元の絶対パス (ユーザー名が出る)", "要確認"),
    (
        # 末尾を英字の TLD に限る. esbuild@0.28.2 のような版の指定に当てないため.
        r"[A-Za-z0-9._%+-]+@(?!example\.(com|org|net)\b)(?!github\.com\b)(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b",
        "メールアドレス",
        "要確認",
    ),
]

# メールアドレスのうち, 出てきてよいもの. コミットの署名 (Co-Authored-By) など.
ALLOWED_EMAIL = re.compile(r"noreply@|@users\.noreply\.github\.com|\.invalid\b")

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tif", ".tiff")

# EXIF の GPS 情報の IFD のタグ.
EXIF_GPS_IFD = 0x8825


@dataclass
class Finding:
    """見つけた 1 件. severity は "NG" か "要確認"."""

    severity: str
    category: str
    where: str
    detail: str


def git(*args: str) -> str:
    """git を実行して標準出力を返す. 失敗したら git のエラーを出して終える."""
    proc = subprocess.run(["git", *args], capture_output=True, text=True, errors="replace")
    if proc.returncode != 0:
        sys.exit(f"git {' '.join(args)} が失敗した: {proc.stderr.strip()}")
    return proc.stdout


def git_bytes(*args: str) -> bytes:
    """git を実行して標準出力をバイト列のまま返す. 画像の中身を読むため."""
    return subprocess.run(["git", *args], capture_output=True, check=True).stdout


def try_git(*args: str) -> str | None:
    """git を実行し, 失敗したら None を返す. 上流のブランチがあるかを確かめるため."""
    proc = subprocess.run(["git", *args], capture_output=True, text=True)
    return proc.stdout.strip() if proc.returncode == 0 else None


def resolve_range(given: str | None) -> tuple[str, str]:
    """調べる範囲と, その説明を返す."""
    if given:
        return given, f"指定した範囲 {given}"
    upstream = try_git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if upstream:
        return f"{upstream}..HEAD", f"{upstream} にまだないコミット"
    branch = try_git("rev-parse", "--abbrev-ref", "HEAD")
    if branch and try_git("rev-parse", "--verify", "--quiet", f"origin/{branch}"):
        return f"origin/{branch}..HEAD", f"origin/{branch} にまだないコミット"
    # リモートにまだ何もないなら, 全部の履歴が上がる.
    return "HEAD", "リモートのブランチがないので, 全部の履歴"


def mask(text: str) -> str:
    """秘密らしい値を伏せる. 出力を人が見たり貼ったりしても漏れないようにするため."""
    return text[:6] + "…" if len(text) > 10 else text


def shorten(line: str) -> str:
    """長い行を切り詰める."""
    line = line.strip()
    return line if len(line) <= MAX_LINE_CHARS else line[:MAX_LINE_CHARS] + "…"


def check_paths(rev_range: str) -> list[Finding]:
    """範囲のコミットで足したり変えたりしたファイルの名前を調べる."""
    out = git("log", "--format=@@%h", "--name-only", "--diff-filter=AMRC", rev_range)
    first_commit: dict[str, str] = {}
    commit = ""
    for line in out.splitlines():
        if line.startswith("@@"):
            commit = line[2:]
        elif line:
            # git log は新しい順なので, 上書きしていけば最初に入れたコミットが残る.
            first_commit[line] = commit
    findings = []
    for path, commit in sorted(first_commit.items()):
        for pattern, reason, severity in PATH_RULES:
            if re.search(pattern, path):
                findings.append(Finding(severity, "置いてはいけないファイル", f"{commit} {path}", reason))
                break
    return findings


def check_text(rev_range: str) -> list[Finding]:
    """範囲のコミットで足した行と, コミットメッセージに秘密情報がないかを調べる."""
    findings = []
    patch = git("log", "-p", "--no-color", "--no-ext-diff", "--format=@@COMMIT %h", rev_range)
    commit = path = ""
    for line in patch.splitlines():
        if line.startswith("@@COMMIT "):
            commit = line.split()[1]
        elif line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else line[4:]
        elif line.startswith("+"):
            findings += match_text(line[1:], f"{commit} {path}")
    messages = git("log", "--format=%h%x00%B%x01", rev_range)
    for record in messages.split("\x01"):
        if "\x00" not in record:
            continue
        commit, body = record.strip("\n").split("\x00", 1)
        for line in body.splitlines():
            findings += match_text(line, f"{commit} (コミットメッセージ)")
    return findings


def match_text(line: str, where: str) -> list[Finding]:
    """1 行を TEXT_RULES に当て, 当たったものを返す."""
    findings = []
    for pattern, reason, severity in TEXT_RULES:
        found = re.search(pattern, line)
        if not found:
            continue
        if reason == "メールアドレス" and ALLOWED_EMAIL.search(found.group(0)):
            continue
        shown = shorten(line.replace(found.group(0), mask(found.group(0))))
        findings.append(Finding(severity, "秘密情報らしい文字列", where, f"{reason}: {shown}"))
    return findings


def new_blobs(rev_range: str) -> list[tuple[str, int, str]]:
    """範囲のコミットで新しく上がるファイルの中身 (blob) の (id, 大きさ, パス) を返す."""
    objects = git("rev-list", "--objects", rev_range)
    batch = subprocess.run(
        ["git", "cat-file", "--batch-check=%(objecttype) %(objectname) %(objectsize) %(rest)"],
        input=objects,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    blobs = []
    for line in batch.splitlines():
        kind, sha, size, *rest = line.split(" ", 3)
        if kind == "blob":
            blobs.append((sha, int(size), rest[0] if rest else "?"))
    return blobs


def check_large(blobs: list[tuple[str, int, str]]) -> list[Finding]:
    """大きすぎるファイルを調べる. 一度上げると履歴から消せず, clone が重くなり続けるため."""
    findings = []
    for _, size, path in blobs:
        if size > LARGE_FILE_BYTES:
            severity = "NG" if size > 50 * 1024 * 1024 else "要確認"
            findings.append(Finding(severity, "大きいファイル", path, f"{size / 1024 / 1024:.1f} MB"))
    return findings


def check_images(blobs: list[tuple[str, int, str]]) -> tuple[list[Finding], str | None]:
    """画像の EXIF に位置情報がないかを調べる. スマホの写真には撮った場所が入ることがあるため."""
    targets = [(sha, path) for sha, _, path in blobs if path.lower().endswith(IMAGE_EXTENSIONS)]
    if not targets:
        return [], None
    try:
        from PIL import Image
    except ImportError:
        return [], f"Pillow がないので, 画像 {len(targets)} 枚の位置情報を調べられなかった"
    findings = []
    for sha, path in targets:
        try:
            exif = Image.open(io.BytesIO(git_bytes("cat-file", "blob", sha))).getexif()
        except Exception as error:  # 読めない形式 (HEIC など) は人に確かめてもらう.
            findings.append(Finding("要確認", "画像の位置情報", path, f"読めなかった ({type(error).__name__})"))
            continue
        if exif.get_ifd(EXIF_GPS_IFD):
            findings.append(Finding("NG", "画像の位置情報", path, "EXIF に GPS の情報がある"))
    return findings, None


def check_ignored() -> list[Finding]:
    """.gitignore で無視するはずなのに追跡しているファイルを調べる. 規則を足す前に入れたものが残るため."""
    out = git("ls-files", "-ci", "--exclude-standard")
    return [Finding("要確認", "無視するはずのファイル", path, ".gitignore に当たるが追跡している") for path in out.splitlines()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("range", nargs="?", help="調べるコミットの範囲 (例: origin/main..HEAD)")
    args = parser.parse_args()

    rev_range, description = resolve_range(args.range)
    commits = git("rev-list", "--count", rev_range).strip()
    print(f"範囲: {rev_range} ({description}, {commits} コミット)")
    if commits == "0":
        print("push するコミットはない.")
        return 0

    blobs = new_blobs(rev_range)
    image_findings, image_note = check_images(blobs)
    findings = check_paths(rev_range) + check_text(rev_range) + check_large(blobs) + image_findings + check_ignored()

    if image_note:
        print(f"注意: {image_note}")
    if not findings:
        print("見つかったものはない.")
        return 0
    for severity in ("NG", "要確認"):
        for finding in (f for f in findings if f.severity == severity):
            print(f"[{severity}] {finding.category}: {finding.where}\n    {finding.detail}")
    ng = sum(f.severity == "NG" for f in findings)
    print(f"\nNG {ng} 件, 要確認 {len(findings) - ng} 件.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
