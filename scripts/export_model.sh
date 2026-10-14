#!/usr/bin/env bash
# モデルリポジトリ (yoloPokerchip) で学習した重み (.pt) を ONNX に変換し,
# models/ と Android の assets に置く.
# export の設定を変えると core/src/detector.cpp の前提が崩れうるので,
# 変える場合は docs/architecture.md も更新すること.
#
# 使い方: scripts/export_model.sh <path/to/best.pt>

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <path/to/best.pt>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PT_PATH="$(realpath "$1")"
PYTHON="${PYTHON:-$ROOT/.venv/bin/python}"
OUT_DIR="$ROOT/models"
OUT_NAME="chip_detector.onnx"
ASSETS_DIR="$ROOT/android/app/src/main/assets"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# ultralytics は .pt の隣に .onnx を書き出すので, 作業ディレクトリにコピーしてから変換する.
cp "$PT_PATH" "$WORK_DIR/model.pt"
"$PYTHON" - "$WORK_DIR/model.pt" <<'PY'
import sys
from ultralytics import YOLO

YOLO(sys.argv[1]).export(
    format="onnx",
    imgsz=640,
    opset=12,
    simplify=True,
    dynamic=False,
    end2end=True,
)
PY

mkdir -p "$OUT_DIR"
cp "$WORK_DIR/model.onnx" "$OUT_DIR/$OUT_NAME"
{
  echo "source: $PT_PATH"
  echo "sha256(pt): $(sha256sum "$PT_PATH" | cut -d' ' -f1)"
  echo "exported_at: $(date -Iseconds)"
} > "$OUT_DIR/VERSION"
echo "Exported: $OUT_DIR/$OUT_NAME"

if [ -d "$(dirname "$ASSETS_DIR")" ]; then
  mkdir -p "$ASSETS_DIR"
  cp "$OUT_DIR/$OUT_NAME" "$ASSETS_DIR/$OUT_NAME"
  echo "Copied to: $ASSETS_DIR/$OUT_NAME"
fi
