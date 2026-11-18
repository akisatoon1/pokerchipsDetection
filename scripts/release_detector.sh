#!/usr/bin/env bash
# 手元でビルドした検出器 (WASM とモデル) を GitHub Release に置き, web/detector.lock を書き換える.
# デプロイの CI は Emscripten も OpenCV もモデルの元の重みも持たないので, ここに置いたものを取ってくる.
# 理由は docs/architecture.md の「11. デプロイ」.
#
# 使い方: scripts/release_detector.sh
# 先に scripts/build_wasm.sh で検出器をビルドし, functional_tests/compare_wasm_cli.sh で CLI と結果が同じかを確かめておく.
# 終わったら web/detector.lock をコミットして push する. 次のデプロイで, この検出器が出る.
#
# Release は公開される. 置くのは, デプロイしたサイトから誰でも取れるものと同じファイルだけ.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# gh は今いるディレクトリの git のリモートから相手のリポジトリを決めるので, ルートに移る.
cd "$ROOT"
DETECTOR_DIR="$ROOT/web/src/client/public/detector"
LOCK="$ROOT/web/detector.lock"
FILES=(pokerchip-core.js pokerchip-core.wasm chip_detector.onnx)

if ! command -v gh >/dev/null; then
  echo "gh がありません. GitHub CLI を入れて gh auth login を済ませる" >&2
  exit 1
fi

for file in "${FILES[@]}"; do
  if [ ! -f "$DETECTOR_DIR/$file" ]; then
    echo "検出器のファイルがありません: $DETECTOR_DIR/$file (scripts/build_wasm.sh で作る)" >&2
    exit 1
  fi
done

# どのコードからビルドしたかを Release に残すので, 検出器のもとになるコードに未コミットの変更があれば止める.
if [ -n "$(git -C "$ROOT" status --porcelain -- core wasm)" ]; then
  echo "core/ か wasm/ に未コミットの変更があります. コミットしてからビルドし直す" >&2
  exit 1
fi

COMMIT="$(git -C "$ROOT" rev-parse HEAD)"
TAG="detector-$(date +%Y%m%d)-$(git -C "$ROOT" rev-parse --short HEAD)"

# 同じタグを上書きすると, そのタグを指す過去のデプロイと中身が食い違うので, 作り直さない.
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG はもうあります. 上書きしない" >&2
  exit 1
fi

SUMS="$(cd "$DETECTOR_DIR" && sha256sum "${FILES[@]}")"
NOTES="$(printf '検出器 (WASM とモデル).\n\nビルドしたコミット: %s\n\n```\n%s\n```\n' "$COMMIT" "$SUMS")"

ASSETS=()
for file in "${FILES[@]}"; do
  ASSETS+=("$DETECTOR_DIR/$file")
done
gh release create "$TAG" "${ASSETS[@]}" --title "$TAG" --notes "$NOTES" --latest=false

{
  echo "# 検出器 (WASM とモデル) の GitHub Release と, ファイルの sha256."
  echo "# scripts/release_detector.sh が書き換え, scripts/fetch_detector.sh が読む. 手で直さない."
  echo "tag $TAG"
  while read -r sum file; do
    echo "sha256 $sum $file"
  done <<<"$SUMS"
} >"$LOCK"

echo "Release $TAG を作り, web/detector.lock を書き換えた. コミットして push すると, 次のデプロイでこの検出器が出る"
