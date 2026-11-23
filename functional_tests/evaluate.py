"""
データセットの画像を CLI で解析し, answers.jsonl の正解と比べて, 画像ごとに正解か不正解かを出す.
ロジックを変えたときに, 今の画像での結果が崩れていないかを確かめるために使う.

不正解のときは, 最初に間違えた段だけを 1 つ出す. 前の段が違うと後の段は比べられないため.
    スタック: 見つかったスタックの数が 1 ではない
    計数:     枚数が違う
    色:       色が違うチップ (上から何枚目か) をすべて

使い方: make build のあと, リポジトリのルートで
    python3 functional_tests/evaluate.py testimages/v2/yoko/single_color
出力の例:
    OK  images/PXL_20261123_093717714.MP.jpg
    NG  images/PXL_20261123_093705462.jpg  スタック: 見つからない
    NG  images/PXL_20261123_094112106.jpg  色: 2 枚目 black -> gray
    正解 30/35
"""

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_CLI = Path("build/pokerchip")
DEFAULT_MODEL = Path("models/chip_detector.onnx")


def judge(answer, stacks):
    """1 枚分の正解と CLI の結果 (スタックの配列) を比べる.

    answer: answers.jsonl の 1 行. 画像にスタックは 1 つだけの前提.
        正解の枚数は colors の要素の数 (枚数の項目は持たない).
    stacks: CLI の --json の stacks. 見つからなかったときは空.
    戻り値: 正解なら None. 不正解なら最初に間違えた段の説明 (色の段では違うチップをすべて並べる).
    """
    if len(stacks) != 1:
        return "スタック: 見つからない" if not stacks else f"スタック: {len(stacks)} 個見つかった"
    stack = stacks[0]
    expected_count = len(answer["colors"])
    if stack["count"] != expected_count:
        actual = "数えられない" if stack["count"] is None else stack["count"]
        return f"計数: 正解 {expected_count}, 結果 {actual}"
    wrong_chips = [
        f"{index} 枚目 {expected} -> {actual}"
        for index, (expected, actual) in enumerate(zip(answer["colors"], stack["colors"]), start=1)
        if expected != actual
    ]
    return "色: " + ", ".join(wrong_chips) if wrong_chips else None


def analyze(cli, model, image, debug_path):
    """CLI で 1 枚を解析し, スタックの配列を返す. スタックが見つからなければ空の配列を返す.

    CLI がほかの理由で失敗したら, 標準エラー出力を添えて RuntimeError を投げる.
    """
    proc = subprocess.run(
        [str(cli), "--model", str(model), "--json", "--out", str(debug_path), str(image)],
        capture_output=True,
        text=True,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("{"):
            return json.loads(line)["stacks"]
    # スタックが 1 つも検出されないと, CLI は JSON を出さずにこのエラーで終わる.
    if "ROI was not selected" in proc.stdout + proc.stderr:
        return []
    raise RuntimeError(f"{image}: CLI が失敗した (終了コード {proc.returncode})\n{proc.stderr}")


def load_answers(dataset):
    """answers.jsonl を 1 行ずつ読み, 辞書の配列で返す."""
    lines = (dataset / "answers.jsonl").read_text().splitlines()
    return [json.loads(line) for line in lines if line.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dataset", type=Path, help="answers.jsonl のあるデータセットのディレクトリ")
    parser.add_argument("--cli", type=Path, default=DEFAULT_CLI, help=f"CLI のパス (既定 {DEFAULT_CLI})")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL, help=f"ONNX のパス (既定 {DEFAULT_MODEL})")
    args = parser.parse_args()

    answers = load_answers(args.dataset)
    correct = 0
    # --out を付けないと CLI は画面に出そうとするので, 捨てる場所に書かせる.
    with tempfile.TemporaryDirectory() as tmp:
        for answer in answers:
            stacks = analyze(args.cli, args.model, args.dataset / answer["file_name"], Path(tmp) / "debug.png")
            mistake = judge(answer, stacks)
            if mistake is None:
                correct += 1
                print(f"OK  {answer['file_name']}")
            else:
                print(f"NG  {answer['file_name']}  {mistake}")
    print(f"正解 {correct}/{len(answers)}")


if __name__ == "__main__":
    sys.exit(main())
