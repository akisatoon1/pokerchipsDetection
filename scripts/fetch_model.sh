#!/usr/bin/env bash
# models/model.lock のタグの GitHub Release からモデル (ONNX) を取り,
# sha256 を確かめてから models/ に置く. デプロイの CI で使う.
# 手元で, 重み (.pt) を持たずにモデルを用意するときにも使える.
#
# 使い方: scripts/fetch_model.sh
# gh が要る. CI では GH_TOKEN を渡す.
# sha256 が合わなければ, 何も置かずに失敗する. 中身の違うモデルを黙って使わないため.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# gh は今いるディレクトリの git のリモートから相手のリポジトリを決めるので, ルートに移る.
cd "$ROOT"
MODEL_DIR="$ROOT/models"
LOCK="$MODEL_DIR/model.lock"

if [ ! -f "$LOCK" ]; then
  echo "models/model.lock がありません. scripts/release_model.sh でモデルの Release を作る" >&2
  exit 1
fi

TAG=""
FILE=""
EXPECTED=""
while read -r kind first second; do
  case "$kind" in
    tag) TAG="$first" ;;
    sha256)
      if [ -n "$FILE" ]; then
        echo "models/model.lock に sha256 の行が 2 つ以上あります" >&2
        exit 1
      fi
      FILE="$second"
      EXPECTED="$first  $second"$'\n'
      ;;
    "" | "#"*) ;;
    *)
      echo "models/model.lock に知らない行があります: $kind" >&2
      exit 1
      ;;
  esac
done <"$LOCK"

if [ -z "$TAG" ] || [ -z "$FILE" ]; then
  echo "models/model.lock にタグか sha256 がありません" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

gh release download "$TAG" --dir "$WORK_DIR" --pattern "$FILE"

if ! (cd "$WORK_DIR" && printf '%s' "$EXPECTED" | sha256sum --check --strict --quiet); then
  echo "Release $TAG のモデルの sha256 が models/model.lock と合いません. 何も置かない" >&2
  exit 1
fi

mkdir -p "$MODEL_DIR"
cp "$WORK_DIR/$FILE" "$MODEL_DIR/$FILE"
echo "Release $TAG のモデルを $MODEL_DIR/$FILE に置いた"
