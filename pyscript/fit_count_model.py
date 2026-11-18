"""
枚数の見当の式 (core/src/counting.cpp の kShape*, kPeriod*) の係数を, 正解付きの画像から求める.
CLI の --features で角度と特徴 (C++ の core が測ったもの) を出させ, 最小二乗で当てはめる.
特徴を Python で測り直さないのは, 判定と同じ処理で測った値で係数を決めるため (色の基準色と同じ考え).

見当のあとの「上の面の境目で枚数を選ぶ」段も, CLI が出す帯の特徴から同じ規則で選び直し,
1 スタック抜き (LOSO) の正答率を出す. 同じスタックを別の角度で撮った画像が学習とテストに
またがると甘くなるため, スタック (枚数と色の組) ごとに抜く.

使い方: make build のあと, リポジトリのルートで
    python3 pyscript/fit_count_model.py
出力: 正答率と, counting.cpp に貼る係数 (C++).
"""

import argparse
import json
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

# core/src/pipeline.hpp の kMaxCountableTiltSin.
MAX_TILT = 0.6
# core/src/counting.cpp の chooseCount の定数.
COLOR_WEIGHT = 0.01
PENALTY = 2.0
NO_BAND_ABOVE = -0.5
AGREEMENT = 1.0
ROW_WIDTH_EXPONENT = 0.5


def measure(cli, model, image):
    """CLI を実行し, 一番大きいスタックの特徴と色を返す. スタックがなければ None."""
    with tempfile.TemporaryDirectory() as tmp:
        out = subprocess.run([cli, "--model", model, "--features", "--json", "--out",
                              f"{tmp}/debug.png", str(image)], capture_output=True, text=True).stdout
    feats = [json.loads(l[len("features "):]) for l in out.splitlines() if l.startswith("features ")]
    result = [json.loads(l) for l in out.splitlines() if l.startswith('{"stacks"')]
    if not feats or not result:
        return None
    # 研究と同じく, 一番大きい箱を数える対象にする.
    i = max(range(len(feats)), key=lambda k: feats[k]["box"][2] * feats[k]["box"][3])
    feats[i]["colors"] = result[0]["stacks"][i]["colors"]
    return feats[i]


def design(rows):
    """形の式と周期の式の, 説明変数と目的変数."""
    s = np.array([r["tilt"]["sin"] for r in rows])
    n = np.array([r["answer"] for r in rows], float)
    h = np.array([r["heightRatio"] for r in rows])
    x = np.array([r["rowWidthRatio"] for r in rows]) ** ROW_WIDTH_EXPONENT
    p = np.array([r["periodRatio"] for r in rows])
    shape = (np.stack([n, n * s, np.ones_like(s), s, s * s], 1), h / x)
    period = (np.stack([n * p, s, np.ones_like(s)], 1), h)
    return shape, period


def fit(rows):
    (a1, y1), (a2, y2) = design(rows)
    return np.linalg.lstsq(a1, y1, rcond=None)[0], np.linalg.lstsq(a2, y2, rcond=None)[0]


def estimate(r, co):
    """counting.cpp の estimateFromShape と同じ式."""
    shape, period = co
    s = r["tilt"]["sin"]
    corrected = r["heightRatio"] / r["rowWidthRatio"] ** ROW_WIDTH_EXPONENT
    by_shape = (corrected - shape[2] - shape[3] * s - shape[4] * s * s) / (shape[0] + shape[1] * s)
    by_period = (r["heightRatio"] - period[1] * s - period[2]) / (period[0] * r["periodRatio"])
    return (by_shape + by_period) / 2 if abs(by_period - by_shape) < AGREEMENT else by_shape


def choose(bands, est):
    """counting.cpp の chooseCount と同じ規則."""
    if not np.isfinite(est) or est > len(bands) + 2:
        return None
    ref = np.median([b[0] for b in bands[:max(3, len(bands) // 2)]]) + 1e-6
    chip = lambda b: b[0] / ref - COLOR_WEIGHT * b[1]
    center = int(np.rint(est))
    best = None
    for n in (center - 1, center, center + 1):
        if n < 1 or n > len(bands):
            continue
        above = chip(bands[n]) if n < len(bands) else NO_BAND_ABOVE
        score = chip(bands[n - 1]) - above - PENALTY * (n - est) ** 2
        if best is None or score > best[1]:
            best = (n, score)
    return None if best is None else best[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", default="testimages/v2/single_color")
    parser.add_argument("--cli", default="build/pokerchip")
    parser.add_argument("--model", default="models/chip_detector.onnx")
    parser.add_argument("--dump", help="測った特徴を書き出す JSON のパス")
    args = parser.parse_args()

    images = Path(args.images)
    answers = [json.loads(l) for l in (images / "answers.jsonl").read_text().splitlines() if l.strip()]
    with ThreadPoolExecutor(12) as pool:
        feats = list(pool.map(lambda a: measure(args.cli, args.model, images / a["file_name"]), answers))
    rows = []
    for a, f in zip(answers, feats):
        if f is None:
            print(f"skip {a['file_name']}: スタックが見つからない")
            continue
        f.update(file=a["file_name"], answer=a["count"], answer_colors=a["colors"])
        rows.append(f)
    if args.dump:
        Path(args.dump).write_text(json.dumps(rows))

    low = [r for r in rows if r["status"] != "tilt_too_large" and "heightRatio" in r]
    print(f"全 {len(rows)} 枚. 角度が大きすぎる {sum(r['status'] == 'tilt_too_large' for r in rows)} 枚,"
          f" 数えられた {sum(r['status'] == 'counted' for r in rows)} 枚, 特徴のある角度小 {len(low)} 枚")

    key = lambda r: (r["answer"], r["answer_colors"][0])
    ok_est, ok_loso = 0, 0
    for st in sorted(set(map(key, low))):
        co = fit([r for r in low if key(r) != st])
        for r in low:
            if key(r) != st:
                continue
            est = estimate(r, co)
            ok_est += round(est) == r["answer"]
            ok_loso += choose(r["bands"], est) == r["answer"]
    print(f"LOSO (角度小 {len(low)} 枚): 見当の丸め {ok_est / len(low):.3f}, 境目で選ぶ {ok_loso / len(low):.3f}")

    # 今の CLI の結果 (counting.cpp に入っている係数) での正答.
    counted = [r for r in low if r["status"] == "counted"]
    cnt = sum(r["count"] == r["answer"] for r in counted)
    cc = sum(r["count"] == r["answer"] and r["colors"] == r["answer_colors"] for r in counted)
    print(f"今の係数の CLI (角度小 {len(low)} 枚): 枚数 {cnt / len(low):.3f}, 色別計数 {cc / len(low):.3f}")

    shape, period = fit(low)
    names = ["kShapeA0", "kShapeA1", "kShapeB0", "kShapeB1", "kShapeB2"]
    print("\n// counting.cpp に貼る係数 (全画像で当てはめ)")
    for name, v in zip(names, shape):
        print(f"const double {name} = {v:.7f};")
    for name, v in zip(["kPeriodK", "kPeriodC", "kPeriodD"], period):
        print(f"const double {name} = {v:.7f};")


if __name__ == "__main__":
    main()
