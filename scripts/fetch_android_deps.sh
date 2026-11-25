#!/usr/bin/env bash
# Android のビルドに要る OpenCV Android SDK (Linux 側と同じ版) を取り, sha256 を確かめてから third_party/ に展開する.
# NDK は取らない. Gradle と make android-native は, Android Studio が SDK に入れた NDK を使う.
#
# 使い方: scripts/fetch_android_deps.sh
# 展開したものがもうあれば何もしない.
# sha256 が合わなければ, 何も展開せずに失敗する. 中身の違う SDK を黙ってリンクしないため.

set -euo pipefail

OPENCV_VERSION="${OPENCV_VERSION:-4.14.0}"

# 版ごとの zip の sha256. OpenCV は配布元で sha256 を出していないので, 初めて取ったときの値を書いておき,
# 以後に取ったものが同じかを確かめる. 版を足すときは, ここに足す.
case "$OPENCV_VERSION" in
  4.14.0) EXPECTED_SHA256="e8cfaf2e51f2e2127a6ede91718d1ef7587f8b6e62db922816e7c33a1f1116a7" ;;
  *)
    echo "OpenCV Android SDK $OPENCV_VERSION の sha256 を知りません. このスクリプトに足す" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THIRD_PARTY="$ROOT/third_party"
OPENCV_SDK_DIR="$THIRD_PARTY/opencv-$OPENCV_VERSION-android-sdk"
ZIP="$THIRD_PARTY/src/opencv-$OPENCV_VERSION-android-sdk.zip"

if [ -d "$OPENCV_SDK_DIR" ]; then
  echo "OpenCV Android SDK $OPENCV_VERSION はもうあります: $OPENCV_SDK_DIR"
  exit 0
fi

mkdir -p "$THIRD_PARTY/src"
if [ ! -f "$ZIP" ]; then
  curl -fL "https://github.com/opencv/opencv/releases/download/$OPENCV_VERSION/opencv-$OPENCV_VERSION-android-sdk.zip" -o "$ZIP.part"
  mv "$ZIP.part" "$ZIP"
fi

if ! printf '%s  %s\n' "$EXPECTED_SHA256" "$ZIP" | sha256sum --check --strict --quiet; then
  # 壊れた, または中身の違う zip を残すと, 次も同じものを使ってしまうので消す.
  rm -f "$ZIP"
  echo "OpenCV Android SDK $OPENCV_VERSION の zip の sha256 が合いません. 展開しない" >&2
  exit 1
fi

tmp="$(mktemp -d "$THIRD_PARTY/src/unzip.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT
unzip -q "$ZIP" -d "$tmp"
# zip の中身は OpenCV-android-sdk/ というディレクトリ名なので, 版付きの名前にする.
mv "$tmp/OpenCV-android-sdk" "$OPENCV_SDK_DIR"
echo "OpenCV Android SDK $OPENCV_VERSION を $OPENCV_SDK_DIR に展開した"
