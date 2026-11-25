#!/usr/bin/env bash
# Web 用の OpenCV を WebAssembly にビルドし, third_party/opencv-4.14.0-wasm に入れる.
# Linux / Android と同じ版を使う. 推論も OpenCV で行い, 版が違うと結果が変わりうるため.
# 理由は docs/architecture.md.
#
# 公式の opencv.js は使わない. JS の API でなく, core から C++ でリンクする静的ライブラリが要るため.
# 設定は OpenCV の platforms/js/build_js.py に合わせ, core が使うモジュールだけをビルドする.
#
# 使い方: scripts/build_opencv_wasm.sh
# 先に scripts/fetch_emsdk.sh (Emscripten) を済ませておく. ソースがなければ scripts/fetch_opencv_source.sh で取る.

set -euo pipefail

OPENCV_VERSION="${OPENCV_VERSION:-4.14.0}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
THIRD_PARTY="$ROOT/third_party"
SRC_DIR="$THIRD_PARTY/src/opencv-$OPENCV_VERSION"
BUILD_DIR="$THIRD_PARTY/build/opencv-$OPENCV_VERSION-wasm"
INSTALL_DIR="$THIRD_PARTY/opencv-$OPENCV_VERSION-wasm"

OPENCV_VERSION="$OPENCV_VERSION" "$ROOT/scripts/fetch_opencv_source.sh"

# shellcheck source=/dev/null
source "$THIRD_PARTY/emsdk/emsdk_env.sh" >/dev/null 2>&1

# -msimd128: WASM の SIMD を使う. 使わないと推論が数倍遅くなる (Safari 16.4 以降が対応).
# -fwasm-exceptions: core が投げる例外を殻で捕まえるため. 殻と同じ設定でビルドしないとリンクできない.
FLAGS="-msimd128 -fwasm-exceptions"

emcmake cmake -S "$SRC_DIR" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_INSTALL_PREFIX="$INSTALL_DIR" \
  -DCMAKE_C_FLAGS="$FLAGS" \
  -DCMAKE_CXX_FLAGS="$FLAGS" \
  -DBUILD_LIST=core,imgproc,dnn \
  -DBUILD_SHARED_LIBS=OFF \
  -DENABLE_PIC=FALSE \
  -DCPU_BASELINE='' \
  -DCPU_DISPATCH='' \
  -DCV_ENABLE_INTRINSICS=ON \
  -DCV_TRACE=OFF \
  -DWITH_PTHREADS_PF=OFF \
  -DBUILD_ZLIB=ON \
  -DWITH_IPP=OFF \
  -DWITH_ITT=OFF \
  -DWITH_OPENCL=OFF \
  -DWITH_EIGEN=OFF \
  -DWITH_LAPACK=OFF \
  -DWITH_TBB=OFF \
  -DWITH_ADE=OFF \
  -DWITH_JPEG=OFF \
  -DWITH_PNG=OFF \
  -DWITH_TIFF=OFF \
  -DWITH_WEBP=OFF \
  -DWITH_OPENJPEG=OFF \
  -DWITH_JASPER=OFF \
  -DWITH_OPENEXR=OFF \
  -DWITH_AVIF=OFF \
  -DWITH_FFMPEG=OFF \
  -DWITH_GSTREAMER=OFF \
  -DWITH_GTK=OFF \
  -DWITH_QT=OFF \
  -DWITH_V4L=OFF \
  -DWITH_1394=OFF \
  -DWITH_VTK=OFF \
  -DWITH_QUIRC=OFF \
  -DBUILD_opencv_apps=OFF \
  -DBUILD_opencv_js=OFF \
  -DBUILD_opencv_python3=OFF \
  -DBUILD_JAVA=OFF \
  -DBUILD_TESTS=OFF \
  -DBUILD_PERF_TESTS=OFF \
  -DBUILD_EXAMPLES=OFF \
  -DBUILD_DOCS=OFF \
  -DBUILD_PACKAGE=OFF

cmake --build "$BUILD_DIR" -j"$(nproc)"
cmake --install "$BUILD_DIR"

echo "OpenCV $OPENCV_VERSION (wasm) installed to $INSTALL_DIR"
