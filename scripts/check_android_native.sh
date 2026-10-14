#!/usr/bin/env bash
# Android Studio を使わずに, core + JNI が Android 向けにビルドできるかを確かめる.
# Gradle が使うのと同じ android/app/src/main/cpp/CMakeLists.txt を NDK でビルドする.
# 事前に scripts/fetch_android_deps.sh を実行しておくこと.
#
# 使い方: scripts/check_android_native.sh [ABI...]   (既定: arm64-v8a x86_64)

set -euo pipefail

NDK_VERSION="${NDK_VERSION:-r27c}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NDK_DIR="$ROOT/third_party/android-ndk-$NDK_VERSION"
ABIS=("$@")
[ ${#ABIS[@]} -eq 0 ] && ABIS=(arm64-v8a x86_64)

for abi in "${ABIS[@]}"; do
  build_dir="$ROOT/build-android/$abi"
  cmake -S "$ROOT/android/app/src/main/cpp" -B "$build_dir" \
    -DCMAKE_TOOLCHAIN_FILE="$NDK_DIR/build/cmake/android.toolchain.cmake" \
    -DANDROID_ABI="$abi" \
    -DANDROID_PLATFORM=android-24 \
    -DANDROID_STL=c++_shared \
    -DCMAKE_BUILD_TYPE=Release > /dev/null
  cmake --build "$build_dir" -j"$(nproc)"
  echo "OK: $build_dir/libpokerchip_jni.so"
done
