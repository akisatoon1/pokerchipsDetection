#!/usr/bin/env bash
# Android Studio を使わずに, core + JNI が Android 向けにビルドできるかを確かめる.
# Gradle が使うのと同じ android/app/src/main/cpp/CMakeLists.txt を, Gradle と同じ SDK の NDK でビルドする.
# 事前に scripts/setup.sh (OpenCV Android SDK の取得) を済ませておくこと.
#
# 使い方: scripts/check_android_native.sh [ABI...]   (既定: arm64-v8a x86_64)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/android.sh
source "$ROOT/scripts/lib/android.sh"

NDK_DIR="$(android_sdk_dir)/ndk/$(android_gradle_value ndkVersion)"
MIN_SDK="$(android_gradle_value minSdk)"
if [ ! -d "$NDK_DIR" ]; then
  echo "NDK がない: $NDK_DIR. Android Studio の SDK Manager で入れる (docs/environment/setup.md)" >&2
  exit 1
fi

ABIS=("$@")
[ ${#ABIS[@]} -eq 0 ] && ABIS=(arm64-v8a x86_64)

for abi in "${ABIS[@]}"; do
  build_dir="$ROOT/build-android/$abi"
  cmake -S "$ROOT/android/app/src/main/cpp" -B "$build_dir" \
    -DCMAKE_TOOLCHAIN_FILE="$NDK_DIR/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM="android-$MIN_SDK" \
    -DANDROID_STL=c++_shared \
    -DCMAKE_BUILD_TYPE=Release > /dev/null
  cmake --build "$build_dir" -j"$(nproc)"
  echo "OK: $build_dir/libpokerchip_jni.so"
done
