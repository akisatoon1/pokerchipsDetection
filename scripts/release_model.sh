#!/usr/bin/env bash
# 手元のモデル (models/chip_detector.onnx) を GitHub Release に置き, models/model.lock を書き換える.
# モデルは重いので git に入れず, Release に置く. デプロイの CI は models/model.lock の Release からモデルを取り,
# core と一緒に WASM にビルドする. 理由は docs/architecture.md の「11. デプロイ」.
#
# 使い方: scripts/release_model.sh
# 先に scripts/export_model.sh でモデルを書き出し, 手元の全体テストで試しておく.
# 終わったら models/model.lock をコミットして push する. 次のデプロイで, このモデルが出る.
#
# Release は公開される. 置くのは, デプロイしたサイトから誰でも取れるモデルと同じファイルだけ.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# gh は今いるディレクトリの git のリモートから相手のリポジトリを決めるので, ルートに移る.
cd "$ROOT"
MODEL="$ROOT/models/chip_detector.onnx"
LOCK="$ROOT/models/model.lock"
FILE="$(basename "$MODEL")"

if ! command -v gh >/dev/null; then
  echo "gh がありません. GitHub CLI を入れて gh auth login を済ませる" >&2
  exit 1
fi

if [ ! -f "$MODEL" ]; then
  echo "モデルがありません: $MODEL (scripts/export_model.sh で作る)" >&2
  exit 1
fi

SUM="$(sha256sum "$MODEL" | cut -d' ' -f1)"
# タグはモデルの中身から決める. 同じモデルなら同じタグになり, 同じものを二重に置かないため.
TAG="model-${SUM:0:12}"

# 同じタグの Release があれば, 中身は同じなので置き直さずに lock だけを書く.
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG はもうあります. 置き直さずに models/model.lock だけを書く"
else
  NOTES="$(printf 'チップの検出のモデル (ONNX).\n\n```\n%s  %s\n```\n' "$SUM" "$FILE")"
  gh release create "$TAG" "$MODEL" --title "$TAG" --notes "$NOTES" --latest=false
fi

{
  echo "# チップの検出のモデル (ONNX) の GitHub Release と, ファイルの sha256."
  echo "# scripts/release_model.sh が書き換え, scripts/fetch_model.sh が読む. 手で直さない."
  echo "tag $TAG"
  echo "sha256 $SUM $FILE"
} >"$LOCK"

echo "models/model.lock を Release $TAG にした. コミットして push すると, 次のデプロイでこのモデルが出る"
