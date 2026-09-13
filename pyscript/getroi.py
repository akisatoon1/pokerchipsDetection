"""
YOLOモデルを使って画像からROIを取得するスクリプト.
"""

import argparse

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image_path")
    args = parser.parse_args()

    model = YOLO("best.pt")
    results_list = model.predict(args.image_path, conf=0.5, imgsz=640, verbose=False)
    if len(results_list) != 1:
        raise RuntimeError(f"Expected one result, but got {len(results_list)}")

    boxes = results_list[0].boxes
    for roi in boxes.xyxy:
        x1, y1, x2, y2 = roi.tolist()
        print(x1, y1, x2, y2)


if __name__ == "__main__":
    main()
