#!/usr/bin/env bash
# Linux 用の OpenCV をソースからビルドし, third_party/ にインストールする.
# Android 側 (OpenCV Android SDK) とバージョンを揃えるため, apt 版 (4.6) は使わない.
# 理由は docs/architecture.md を参照.
#
# 使い方: scripts/build_opencv.sh
# imshow / selectROI を使うには事前に GTK の開発パッケージが必要:
#   sudo apt install libgtk-3-dev

set -euo pipefail

OPENCV_VERSION="${OPENCV_VERSION:-4.14.0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THIRD_PARTY="$ROOT/third_party"
SRC_DIR="$THIRD_PARTY/src/opencv-$OPENCV_VERSION"
BUILD_DIR="$THIRD_PARTY/build/opencv-$OPENCV_VERSION"
INSTALL_DIR="$THIRD_PARTY/opencv-$OPENCV_VERSION"

mkdir -p "$THIRD_PARTY/src" "$BUILD_DIR"

if [ ! -d "$SRC_DIR" ]; then
  curl -fL "https://github.com/opencv/opencv/archive/refs/tags/$OPENCV_VERSION.tar.gz" \
    -o "$THIRD_PARTY/src/opencv-$OPENCV_VERSION.tar.gz"
  tar -xzf "$THIRD_PARTY/src/opencv-$OPENCV_VERSION.tar.gz" -C "$THIRD_PARTY/src"
fi

# 必要なモジュールだけビルドする.
# core/imgproc/dnn は共通ロジック, imgcodecs/highgui は Linux の CLI 用.
cmake -S "$SRC_DIR" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
  -DBUILD_LIST=core,imgproc,imgcodecs,highgui,dnn \
  -DBUILD_TESTS=OFF \
  -DBUILD_PERF_TESTS=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DBUILD_opencv_apps=OFF \
  -DBUILD_opencv_python3=OFF \
  -DBUILD_JAVA=OFF \
  -DWITH_GTK=ON \
  -DWITH_QT=OFF

cmake --build "$BUILD_DIR" -j"$(nproc)"
cmake --install "$BUILD_DIR"

echo "OpenCV $OPENCV_VERSION installed to $INSTALL_DIR"
