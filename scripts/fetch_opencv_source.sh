#!/usr/bin/env bash
# OpenCV のソースを GitHub の公式のリポジトリから取り, sha256 を確かめてから third_party/src/ に展開する.
# Linux 用 (scripts/build_opencv.sh) と WASM 用 (scripts/build_opencv_wasm.sh) のビルドが使う.
# デプロイの CI でも, WASM 用の OpenCV をビルドするときに使う.
#
# 使い方: scripts/fetch_opencv_source.sh
# 展開したソースがもうあれば何もしない.
# sha256 が合わなければ, 何も展開せずに失敗する. 中身の違うソースを黙ってビルドしないため.

set -euo pipefail

OPENCV_VERSION="${OPENCV_VERSION:-4.14.0}"

# 版ごとの tarball の sha256. OpenCV は配布元で sha256 を出していないので, 初めて取ったときの値を書いておき,
# 以後に取ったものが同じかを確かめる. 版を足すときは, ここに足す.
case "$OPENCV_VERSION" in
  4.14.0) EXPECTED_SHA256="ee8fb9b30eb60850431b4656447080e3737b56e45719c92b67f245950609f86e" ;;
  *)
    echo "OpenCV $OPENCV_VERSION の sha256 を知りません. このスクリプトに足す" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC_PARENT="$ROOT/third_party/src"
SRC_DIR="$SRC_PARENT/opencv-$OPENCV_VERSION"
TARBALL="$SRC_PARENT/opencv-$OPENCV_VERSION.tar.gz"

if [ -d "$SRC_DIR" ]; then
  echo "OpenCV $OPENCV_VERSION のソースはもうあります: $SRC_DIR"
  exit 0
fi

mkdir -p "$SRC_PARENT"
if [ ! -f "$TARBALL" ]; then
  curl -fsSL "https://github.com/opencv/opencv/archive/refs/tags/$OPENCV_VERSION.tar.gz" -o "$TARBALL.part"
  mv "$TARBALL.part" "$TARBALL"
fi

if ! printf '%s  %s\n' "$EXPECTED_SHA256" "$TARBALL" | sha256sum --check --strict --quiet; then
  # 壊れた, または中身の違う tarball を残すと, 次も同じものを使ってしまうので消す.
  rm -f "$TARBALL"
  echo "OpenCV $OPENCV_VERSION の tarball の sha256 が合いません. 展開しない" >&2
  exit 1
fi

tar -xzf "$TARBALL" -C "$SRC_PARENT"
echo "OpenCV $OPENCV_VERSION のソースを $SRC_DIR に展開した"
