"""
YOLOモデルを使って画像からROIを取得するスクリプト.
"""

import argparse
import sys

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    args = parser.parse_args()

    model = YOLO("best.pt")
    results_list = model.predict(args.image_path, conf=0.5, imgsz=640, verbose=False)
    if len(results_list) != 1:
        print(
            "Error: Expected one results, but got", len(results_list), file=sys.stderr
        )
        sys.exit(1)

    boxes = results_list[0].boxes
    if len(boxes) != 1:
        # TODO: 画像にボックスは1つだけと仮定する. 後で直す.
        print("Error: Expected one box, but got", len(boxes), file=sys.stderr)
        sys.exit(1)

    roi = boxes.xyxy[0]
    x1, y1, x2, y2 = roi.tolist()
    # C++側がログ行と区別できるよう目印を付ける.
    print(x1, y1, x2, y2)


if __name__ == "__main__":
    main()
