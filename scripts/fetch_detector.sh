#!/usr/bin/env bash
# web/detector.lock のタグの GitHub Release から検出器 (WASM とモデル) を取り,
# sha256 を確かめてから Web で配る場所 (web/src/client/public/detector/) に置く.
# デプロイの CI で使う. 手元で scripts/build_wasm.sh の代わりに使ってもよい.
#
# 使い方: scripts/fetch_detector.sh
# gh が要る. CI では GH_TOKEN を渡す.
# sha256 が 1 つでも合わなければ, 何も置かずに失敗する. 中身の違う検出器を黙って配らないため.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# gh は今いるディレクトリの git のリモートから相手のリポジトリを決めるので, ルートに移る.
cd "$ROOT"
DETECTOR_DIR="$ROOT/web/src/client/public/detector"
LOCK="$ROOT/web/detector.lock"

if [ ! -f "$LOCK" ]; then
  echo "web/detector.lock がありません. scripts/release_detector.sh で検出器の Release を作る" >&2
  exit 1
fi

TAG=""
FILES=()
EXPECTED=""
while read -r kind first second; do
  case "$kind" in
    tag) TAG="$first" ;;
    sha256)
      FILES+=("$second")
      EXPECTED+="$first  $second"$'\n'
      ;;
    "" | "#"*) ;;
    *)
      echo "web/detector.lock に知らない行があります: $kind" >&2
      exit 1
      ;;
  esac
done <"$LOCK"

if [ -z "$TAG" ] || [ "${#FILES[@]}" -eq 0 ]; then
  echo "web/detector.lock にタグか sha256 がありません" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

PATTERNS=()
for file in "${FILES[@]}"; do
  PATTERNS+=(--pattern "$file")
done
gh release download "$TAG" --dir "$WORK_DIR" "${PATTERNS[@]}"

if ! (cd "$WORK_DIR" && printf '%s' "$EXPECTED" | sha256sum --check --strict --quiet); then
  echo "Release $TAG のファイルの sha256 が web/detector.lock と合いません. 何も置かない" >&2
  exit 1
fi

mkdir -p "$DETECTOR_DIR"
for file in "${FILES[@]}"; do
  cp "$WORK_DIR/$file" "$DETECTOR_DIR/$file"
done
echo "Release $TAG の検出器を $DETECTOR_DIR に置いた"
