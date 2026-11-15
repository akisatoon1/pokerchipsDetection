#!/usr/bin/env bash
# Web で core を動かすための Emscripten (emsdk) を third_party/emsdk に取得する.
# core を WebAssembly にビルドするのに使う. 理由は docs/architecture.md.
#
# 版を固定するのは, 版が変わると WASM の計算 (浮動小数の扱いや SIMD) が変わり,
# Linux の結果と一致しなくなるおそれがあるため.
#
# 使い方: scripts/fetch_emsdk.sh
# 取得したあとは, 使うシェルで source third_party/emsdk/emsdk_env.sh を実行する.

set -euo pipefail

EMSDK_VERSION="${EMSDK_VERSION:-6.0.13}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMSDK_DIR="$ROOT/third_party/emsdk"

if [ ! -d "$EMSDK_DIR" ]; then
  git clone https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
fi

"$EMSDK_DIR/emsdk" install "$EMSDK_VERSION"
"$EMSDK_DIR/emsdk" activate "$EMSDK_VERSION"

echo "Emscripten $EMSDK_VERSION installed to $EMSDK_DIR"
