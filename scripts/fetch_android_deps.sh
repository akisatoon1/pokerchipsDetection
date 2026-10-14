#!/usr/bin/env bash
# Android ビルドに必要な外部ファイルを third_party/ に取得する.
#   - OpenCV Android SDK (Linux 側と同じバージョン)
#   - Android NDK (Android Studio を使わずに core のクロスコンパイルを確かめる用)
#
# 使い方: scripts/fetch_android_deps.sh [--no-ndk]

set -euo pipefail

OPENCV_VERSION="${OPENCV_VERSION:-4.14.0}"
NDK_VERSION="${NDK_VERSION:-r27c}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THIRD_PARTY="$ROOT/third_party"
mkdir -p "$THIRD_PARTY/src"

OPENCV_SDK_DIR="$THIRD_PARTY/opencv-$OPENCV_VERSION-android-sdk"
if [ ! -d "$OPENCV_SDK_DIR" ]; then
  zip="$THIRD_PARTY/src/opencv-$OPENCV_VERSION-android-sdk.zip"
  curl -fL "https://github.com/opencv/opencv/releases/download/$OPENCV_VERSION/opencv-$OPENCV_VERSION-android-sdk.zip" -o "$zip"
  tmp="$(mktemp -d "$THIRD_PARTY/src/unzip.XXXXXX")"
  unzip -q "$zip" -d "$tmp"
  # zip の中身は OpenCV-android-sdk/ というディレクトリ名なので, バージョン付きの名前にする.
  mv "$tmp/OpenCV-android-sdk" "$OPENCV_SDK_DIR"
  rmdir "$tmp"
fi
echo "OpenCV Android SDK: $OPENCV_SDK_DIR"

if [ "${1:-}" != "--no-ndk" ]; then
  NDK_DIR="$THIRD_PARTY/android-ndk-$NDK_VERSION"
  if [ ! -d "$NDK_DIR" ]; then
    zip="$THIRD_PARTY/src/android-ndk-$NDK_VERSION-linux.zip"
    curl -fL "https://dl.google.com/android/repository/android-ndk-$NDK_VERSION-linux.zip" -o "$zip"
    unzip -q "$zip" -d "$THIRD_PARTY"
  fi
  echo "Android NDK: $NDK_DIR"
fi
