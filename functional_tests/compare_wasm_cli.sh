#!/usr/bin/env bash
# testimages のすべての画像を WASM の core と Linux の CLI で解析し, 結果が一致するかを確かめる.
# 判定の基準 (box, count, peaks, colors が一致し, score の差が 0.001 以内) は compare_wasm_cli.mjs にある.
#
# 使い方: functional_tests/compare_wasm_cli.sh [画像...]
# 画像を省略すると testimages の下の jpg と png をすべて使う.
# 先に make build (CLI) と scripts/build_wasm.sh (WASM) を済ませておく.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPENCV_DIR="$ROOT/third_party/opencv-4.14.0"
WORK_DIR="$ROOT/build/functional_tests"
DECODE="$WORK_DIR/decode_rgba"
mkdir -p "$WORK_DIR"

# CLI と同じ OpenCV (Linux 用) でビルドする.
c++ -std=c++17 -O2 -Wall -Wextra \
  -I"$OPENCV_DIR/include/opencv4" \
  functional_tests/decode_rgba.cpp -o "$DECODE" \
  -L"$OPENCV_DIR/lib" -Wl,-rpath,"$OPENCV_DIR/lib" \
  -lopencv_imgcodecs -lopencv_imgproc -lopencv_core

if [ "$#" -gt 0 ]; then
  images=("$@")
else
  mapfile -t images < <(find testimages -type f \( -iname '*.jpg' -o -iname '*.png' \) | sort)
fi

node functional_tests/compare_wasm_cli.mjs \
  web/src/client/public/detector/pokerchip-core.js \
  web/src/client/public/detector/chip_detector.onnx \
  build/pokerchip "$DECODE" "$WORK_DIR" "${images[@]}"
