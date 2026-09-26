#!/usr/bin/env python3
"""
指定ディレクトリ内の .heic / .heif をすべて .jpg に変換し、
別ディレクトリに出力するスクリプト。

使い方:
    python heic2jpg.py path/to/images
    python heic2jpg.py path/to/images -o out_dir -q 90 -r

必要なパッケージ:
    pip install pillow pillow-heif
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    import pillow_heif
except ImportError:
    sys.exit(
        "pillow-heif が見つかりません。\n"
        "  pip install pillow pillow-heif\n"
        "を実行してください。"
    )

pillow_heif.register_heif_opener()

HEIC_SUFFIXES = {".heic", ".heif", ".hif"}


def convert_one(src: Path, dst: Path, quality: int, keep_exif: bool) -> None:
    """HEIC 1枚を JPEG に変換して dst に保存する。"""
    with Image.open(src) as im:
        # 撮影時の向き(EXIF Orientation)をピクセルに焼き込む
        im = ImageOps.exif_transpose(im)

        # JPEG はアルファ非対応なので白背景に合成する
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        elif im.mode != "RGB":
            im = im.convert("RGB")

        save_kwargs = {"quality": quality, "optimize": True}
        if keep_exif:
            exif = im.info.get("exif")
            if exif:
                save_kwargs["exif"] = exif
            icc = im.info.get("icc_profile")
            if icc:
                save_kwargs["icc_profile"] = icc

        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, "JPEG", **save_kwargs)


def collect_files(src_dir: Path, recursive: bool) -> list[Path]:
    it = src_dir.rglob("*") if recursive else src_dir.glob("*")
    return sorted(p for p in it if p.is_file() and p.suffix.lower() in HEIC_SUFFIXES)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="ディレクトリ内の HEIC をすべて JPG に変換します。"
    )
    parser.add_argument("src", type=Path, help="HEIC が入っているディレクトリ")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="出力先ディレクトリ (既定: <入力ディレクトリ名>_jpg)",
    )
    parser.add_argument(
        "-q",
        "--quality",
        type=int,
        default=95,
        help="JPEG 品質 1-100 (既定: 95)",
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="サブディレクトリも再帰的に処理し、階層構造を保って出力する",
    )
    parser.add_argument(
        "--no-exif",
        action="store_true",
        help="EXIF / ICC プロファイルを引き継がない",
    )
    parser.add_argument(
        "-f",
        "--force",
        action="store_true",
        help="出力先に同名ファイルがあっても上書きする",
    )
    args = parser.parse_args()

    src_dir: Path = args.src.expanduser().resolve()
    if not src_dir.is_dir():
        print(f"エラー: ディレクトリが見つかりません: {src_dir}", file=sys.stderr)
        return 1

    out_dir: Path = (
        args.output.expanduser().resolve()
        if args.output
        else src_dir.parent / f"{src_dir.name}_jpg"
    )

    files = collect_files(src_dir, args.recursive)
    if not files:
        print(f"HEIC ファイルが見つかりませんでした: {src_dir}")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"入力: {src_dir}\n出力: {out_dir}\n対象: {len(files)} 件\n")

    ok = skipped = failed = 0
    for i, src in enumerate(files, 1):
        rel = src.relative_to(src_dir).with_suffix(".jpg")
        dst = out_dir / rel

        if dst.exists() and not args.force:
            print(f"[{i}/{len(files)}] スキップ (既存): {rel}")
            skipped += 1
            continue

        try:
            convert_one(src, dst, args.quality, keep_exif=not args.no_exif)
            print(f"[{i}/{len(files)}] {src.name} -> {rel}")
            ok += 1
        except Exception as e:  # 1枚失敗しても止めない
            print(f"[{i}/{len(files)}] 失敗: {src.name} ({e})", file=sys.stderr)
            failed += 1

    print(f"\n完了: 成功 {ok} / スキップ {skipped} / 失敗 {failed}")
    print(f"出力ディレクトリ: {out_dir}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
