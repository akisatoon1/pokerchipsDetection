"""
データセットの画像を CLI で解析し, answers.jsonl の正解と比べて, 画像ごとに正解か不正解かを出す.
ロジックを変えたときに, 今の画像での結果が崩れていないかを確かめるために使う.

不正解のときは, 最初に間違えた段だけを 1 つ出す. 前の段が違うと後の段は比べられないため.
    スタック: 見つかったスタックの数が正解と違う
    計数:     枚数が違う
    色:       色が違うチップ (上から何枚目か) をすべて
計数と色はスタックごとに比べる. 正解のスタックには位置がないので, 正解と見つかったスタックを
いちばん合う組み合わせで突き合わせる. スタックが 2 つ以上なら, 間違えたスタックを左から何本目かで示す.

使い方: make build のあと, リポジトリのルートで
    python3 functional_tests/evaluate.py testimages/v2/yoko/single_color
出力の例:
    OK  images/PXL_20261123_093717714.MP.jpg
    NG  images/PXL_20261123_093705462.jpg  スタック: 正解 1 個, 見つからない
    NG  images/PXL_20261123_094112106.jpg  色: 2 枚目 期待:black, 間違い:gray
    正解 30/35
"""

import argparse
import itertools
import json
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_CLI = Path("build/pokerchip")
DEFAULT_MODEL = Path("models/chip_detector.onnx")


def judge_stack(expected_colors, stack):
    """正解の 1 スタックと, CLI が見つけた 1 スタックを比べる.

    expected_colors: 正解の色. 上のチップから順. 正解の枚数はこの要素の数 (枚数の項目は持たない).
    stack: CLI の --json の stacks の 1 要素.
    戻り値: 合っていれば None. 違えば最初に間違えた段の説明 (色の段では違うチップをすべて並べる).
    """
    expected_count = len(expected_colors)
    if stack["count"] != expected_count:
        actual = "数えられない" if stack["count"] is None else stack["count"]
        return f"計数: 正解 {expected_count}, 結果 {actual}"
    wrong_chips = [
        f"{index} 枚目 期待:{expected}, 間違い:{actual}"
        for index, (expected, actual) in enumerate(zip(expected_colors, stack["colors"]), start=1)
        if expected != actual
    ]
    return "色: " + ", ".join(wrong_chips) if wrong_chips else None


def judge(answer, stacks):
    """1 枚分の正解と CLI の結果 (スタックの配列) を比べる.

    正解のスタックは並びを問わないので, 正解と見つかったスタックの組み合わせをすべて試し,
    間違えたスタックがいちばん少ない組み合わせで判定する. 同じ数なら, 枚数の差の合計が小さい組み合わせをとる.
    枚数の近いもの同士を突き合わせたほうが, 間違いの説明が分かりやすいため.
    answer: answers.jsonl の 1 行.
    stacks: CLI の --json の stacks. 左から順. 見つからなかったときは空.
    戻り値: 正解なら None. 不正解なら間違いの説明.
    """
    expected = [s["colors"] for s in answer["stacks"]]
    if len(stacks) != len(expected):
        found = "見つからない" if not stacks else f"{len(stacks)} 個見つかった"
        return f"スタック: 正解 {len(expected)} 個, {found}"
    # スタックは 1 枚に数個なので, 並べ方をすべて試しても十分に速い.
    candidates = []
    for order in itertools.permutations(expected):
        mistakes = [judge_stack(colors, stack) for colors, stack in zip(order, stacks)]
        candidates.append((count_mistakes(mistakes), count_gap(order, stacks), mistakes))
    # 同じ順位なら先に試したものが残るよう, 順位だけで比べる.
    mistake_count, _, best = min(candidates, key=lambda c: (c[0], c[1]))
    if mistake_count == 0:
        return None
    if len(stacks) == 1:
        return best[0]
    return ", ".join(f"左から {i} 本目 {m}" for i, m in enumerate(best, start=1) if m is not None)


def count_mistakes(mistakes):
    """judge_stack の結果の配列のうち, 間違えたスタックの数を返す."""
    return sum(m is not None for m in mistakes)


def count_gap(expected, stacks):
    """突き合わせた正解と結果の, 枚数の差の合計を返す. 数えられなかったスタックは正解の枚数との差を全部とする."""
    return sum(abs(len(colors) - (stack["count"] or 0)) for colors, stack in zip(expected, stacks))


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
