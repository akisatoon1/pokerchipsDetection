"""
ultralytics での検出結果を書き出し, C++ (OpenCV DNN) 版の検出器と比べる基準にする.
C++ 版と同じ ONNX モデルを渡すこと. best.pt を渡すと入力画像の余白の付け方が
変わり (正方形でなく長方形で推論する), 結果が少しずれる.
モデルを更新したら作り直すこと.

使い方: .venv/bin/python pyscript/make_yolo_reference.py models/chip_detector.onnx
出力: 1行に1検出. "<画像パス> x1 y1 x2 y2 score". 検出がない画像は "<画像パス>" のみ.
"""

import argparse
from pathlib import Path

import torchvision
from ultralytics import YOLO

# C++ 版 (core/src/detector.cpp) と同じ値.
CONF = 0.5
IOU = 0.7


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("model_path")
    parser.add_argument("--images", default="testimages/yoko")
    # ultralytics が標準出力にログを出すので, 結果はファイルに書く.
    parser.add_argument("--out", default="tests/data/yolo_reference.txt")
    args = parser.parse_args()

    model = YOLO(args.model_path, task="detect")
    lines = []
    for path in sorted(Path(args.images).rglob("*.jpg")):
        result = model.predict(str(path), conf=CONF, imgsz=640, verbose=False)[0]
        boxes = result.boxes

        # end2end のモデルは NMS をかけずに返すが, C++ 版は重複を除くため NMS をかける.
        # 合わせるためにここでもクラスごとに NMS をかける.
        keep = torchvision.ops.batched_nms(boxes.xyxy, boxes.conf, boxes.cls, IOU)
        if len(keep) == 0:
            lines.append(f"{path}")
        for i in keep.tolist():
            x1, y1, x2, y2 = boxes.xyxy[i].tolist()
            lines.append(f"{path} {x1:.2f} {y1:.2f} {x2:.2f} {y2:.2f} {boxes.conf[i]:.4f}")

    Path(args.out).write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
