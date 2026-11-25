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

# 版を上げるときは, emsdk のリポジトリのその版のタグのコミット (git ls-remote --tags で見る) も一緒に変える.
EMSDK_VERSION="6.0.13"
EMSDK_COMMIT="35659964bc2762fffec0d257997fb61475f765b7"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EMSDK_DIR="$ROOT/third_party/emsdk"

# emsdk 自体も版のタグで取り, コミットを確かめる. 最新を取ると, 知らない変更の入った emsdk を動かすことになるため.
# タグは差し替えられうるので, タグだけでなくコミットでも確かめる.
if [ ! -d "$EMSDK_DIR" ]; then
  git clone --depth 1 --branch "$EMSDK_VERSION" https://github.com/emscripten-core/emsdk.git "$EMSDK_DIR"
else
  git -C "$EMSDK_DIR" fetch --depth 1 origin tag "$EMSDK_VERSION"
  git -C "$EMSDK_DIR" checkout --quiet --detach "$EMSDK_VERSION"
fi
if [ "$(git -C "$EMSDK_DIR" rev-parse HEAD)" != "$EMSDK_COMMIT" ]; then
  echo "emsdk のタグ $EMSDK_VERSION のコミットが $EMSDK_COMMIT ではありません. 使わずに止める" >&2
  exit 1
fi

"$EMSDK_DIR/emsdk" install "$EMSDK_VERSION"
"$EMSDK_DIR/emsdk" activate "$EMSDK_VERSION"

echo "Emscripten $EMSDK_VERSION installed to $EMSDK_DIR"
