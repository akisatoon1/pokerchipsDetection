#!/usr/bin/env bash
# core を WebAssembly にビルドし, Web で配る場所 (web/src/client/public/detector/) にモデルと一緒に置く.
# 置いたファイルはビルドの結果なので git では管理しない.
#
# 使い方: scripts/build_wasm.sh
# 先に scripts/fetch_emsdk.sh と scripts/build_opencv_wasm.sh を済ませ,
# models/chip_detector.onnx を用意しておく (scripts/export_model.sh).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT/build-wasm"
OUT_DIR="$ROOT/web/src/client/public/detector"
MODEL="$ROOT/models/chip_detector.onnx"

if [ ! -f "$MODEL" ]; then
  echo "モデルがありません: $MODEL (scripts/export_model.sh で作る)" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$ROOT/third_party/emsdk/emsdk_env.sh" >/dev/null 2>&1

emcmake cmake -S "$ROOT/wasm" -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE=Release
cmake --build "$BUILD_DIR" -j"$(nproc)"

mkdir -p "$OUT_DIR"
cp "$BUILD_DIR/pokerchip-core.js" "$BUILD_DIR/pokerchip-core.wasm" "$OUT_DIR/"
cp "$MODEL" "$OUT_DIR/chip_detector.onnx"

echo "WASM とモデルを $OUT_DIR に置いた"
ls -l "$OUT_DIR"
