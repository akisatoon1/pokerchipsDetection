"""
色判定の基準色 (core/src/color.cpp の kReferences) を, 正解付きの画像から求める.
CLI の --lab でチップごとの代表色 (補正後の Lab) を出させ, 正解の色ごとに中央値をとる.
代表色は C++ の core が計算するので, 判定と同じ補正がかかった値になる.
チップセットを変えたときや, 補正の処理を変えたときに作り直すこと.

使い方: make build のあと, リポジトリのルートで
    .venv/bin/python pyscript/make_color_references.py
出力: kReferences の初期化子 (C++). color.cpp に貼り付ける.
"""

import argparse
import re
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

import numpy as np

# core/src/color.cpp の ChipColor の順.
COLORS = [
    ("red", "kRed"),
    ("blue", "kBlue"),
    ("yellow", "kYellow"),
    ("black", "kBlack"),
    ("gray", "kGray"),
    ("purple", "kPurple"),
    ("green", "kGreen"),
]

LAB = re.compile(r"\(([-\d.]+), ([-\d.]+), ([-\d.]+)\)")


def load_answers(path):
    """ファイル名 -> スタックごとの色の並び (左のスタックから順)."""
    answers = defaultdict(list)
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, count, *colors = line.split()
        assert int(count) == len(colors), line
        answers[name].append(colors)
    return answers


def measure(cli, image):
    """CLI を実行し, スタックごとの代表色の並びを返す."""
    # --out を付けないと CLI はデバッグ画像を画面に出して止まるので, 捨てる場所に保存させる.
    with tempfile.TemporaryDirectory() as tmp:
        out = subprocess.run([cli, "--lab", "--out", f"{tmp}/debug.png", str(image)],
                             capture_output=True, text=True).stdout
    stacks = []
    for line in out.splitlines():
        if "chip lab" in line:
            stacks.append([tuple(map(float, m)) for m in LAB.findall(line)])
    return stacks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", default="testimages/yoko/stack/multicolor_jpg")
    parser.add_argument("--cli", default="build/pokerchip")
    args = parser.parse_args()

    images = Path(args.images)
    by_color = defaultdict(list)
    for name, answer in load_answers(images / "answers.txt").items():
        stacks = measure(args.cli, images / name)
        # 検出や枚数が正解と合わないスタックは, チップと色の対応が取れないので使わない.
        if len(stacks) != len(answer):
            print(f"skip {name}: {len(stacks)} stacks (answer {len(answer)})", file=sys.stderr)
            continue
        for labs, colors in zip(stacks, answer):
            if len(labs) != len(colors):
                print(f"skip {name}: {len(labs)} chips (answer {len(colors)})", file=sys.stderr)
                continue
            for lab, color in zip(labs, colors):
                by_color[color].append(lab)

    print("const std::array<Reference, kNumColorClasses> kReferences = {{")
    for color, enum in COLORS:
        if not by_color[color]:
            sys.exit(f"no chips for {color}")
        values = np.array(by_color[color])
        l, a, b = np.median(values, axis=0)
        print(f"    {{ChipColor::{enum}, {l:.1f}F, {a:.1f}F, {b:.1f}F}},  "
              f"// n={len(values)}")
    print("}};")


if __name__ == "__main__":
    main()
