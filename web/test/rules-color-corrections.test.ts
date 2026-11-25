import { describe, expect, it } from "vitest";
import type { AnalysisResult, StackResult } from "../src/rules/analysis-result";
import { computeChipPoints } from "../src/rules/chip-points";
import type { ChipColorName } from "../src/rules/chip-values";
import {
  applyColorCorrections,
  correctChipColor,
  correctedColorAt,
  countCorrectedChips,
  NO_CORRECTIONS,
  revertChipColor,
} from "../src/rules/color-corrections";

const values = new Map<ChipColorName, number>([
  ["red", 100],
  ["blue", 500],
  ["gray", 10],
]);

function stack(colors: string[]): StackResult {
  return {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    score: 0.9,
    count: colors.length,
    peaks: [],
    colors,
  };
}

function result(...stacks: StackResult[]): AnalysisResult {
  return { stacks };
}

function colorsOf(analysis: AnalysisResult): string[][] {
  return analysis.stacks.map((item) => item.colors);
}

describe("チップの色を手で直す", () => {
  it("直したチップの色だけが変わり, ほかのチップとスタックは検出のまま", () => {
    const detected = result(stack(["red", "blue", "red"]), stack(["gray"]));
    const corrections = correctChipColor(
      detected,
      NO_CORRECTIONS,
      { stackIndex: 0, chipIndex: 1 },
      "red",
    );
    expect(colorsOf(applyColorCorrections(detected, corrections))).toEqual([
      ["red", "red", "red"],
      ["gray"],
    ]);
  });

  it("直した結果から求めた持ち点は, 直した色の点数で計算する", () => {
    const detected = result(stack(["red", "blue"]));
    const corrections = correctChipColor(
      detected,
      NO_CORRECTIONS,
      { stackIndex: 0, chipIndex: 1 },
      "gray",
    );
    expect(
      computeChipPoints([applyColorCorrections(detected, corrections)], values),
    ).toMatchObject({ ok: true, total: 110 });
  });

  it("色が unknown のチップを直すと, 止めずに持ち点を求められる", () => {
    const detected = result(stack(["red", "unknown"]));
    expect(computeChipPoints([detected], values)).toMatchObject({ ok: false });
    const corrections = correctChipColor(
      detected,
      NO_CORRECTIONS,
      { stackIndex: 0, chipIndex: 1 },
      "blue",
    );
    expect(
      computeChipPoints([applyColorCorrections(detected, corrections)], values),
    ).toMatchObject({ ok: true, total: 600 });
  });

  it("同じチップを 2 回直したら, あとの色になる", () => {
    const detected = result(stack(["red"]));
    const position = { stackIndex: 0, chipIndex: 0 };
    const first = correctChipColor(detected, NO_CORRECTIONS, position, "blue");
    const second = correctChipColor(detected, first, position, "gray");
    expect(correctedColorAt(second, position)).toBe("gray");
    expect(countCorrectedChips(second)).toBe(1);
  });

  it("検出のときと同じ色に直したら, 直したものに数えない", () => {
    const detected = result(stack(["red", "blue"]));
    const position = { stackIndex: 0, chipIndex: 0 };
    const changed = correctChipColor(
      detected,
      NO_CORRECTIONS,
      position,
      "blue",
    );
    const back = correctChipColor(detected, changed, position, "red");
    expect(correctedColorAt(back, position)).toBeNull();
    expect(countCorrectedChips(back)).toBe(0);
  });

  it("戻すと検出のときの色になり, 直したものに数えない", () => {
    const detected = result(stack(["red", "blue"]));
    const position = { stackIndex: 0, chipIndex: 1 };
    const changed = correctChipColor(detected, NO_CORRECTIONS, position, "red");
    const reverted = revertChipColor(changed, position);
    expect(countCorrectedChips(reverted)).toBe(0);
    expect(colorsOf(applyColorCorrections(detected, reverted))).toEqual([
      ["red", "blue"],
    ]);
  });

  it("直しても, 元の解析の結果と直す前のものは変わらない", () => {
    const detected = result(stack(["red", "blue"]));
    const corrections = correctChipColor(
      detected,
      NO_CORRECTIONS,
      { stackIndex: 0, chipIndex: 0 },
      "gray",
    );
    applyColorCorrections(detected, corrections);
    revertChipColor(corrections, { stackIndex: 0, chipIndex: 0 });
    expect(colorsOf(detected)).toEqual([["red", "blue"]]);
    expect(countCorrectedChips(NO_CORRECTIONS)).toBe(0);
    expect(countCorrectedChips(corrections)).toBe(1);
  });

  it("解析の結果にない位置を直そうとしたら, 例外にする", () => {
    const detected = result(stack(["red", "blue"]));
    for (const position of [
      { stackIndex: 1, chipIndex: 0 },
      { stackIndex: 0, chipIndex: 2 },
      { stackIndex: -1, chipIndex: 0 },
    ]) {
      expect(() =>
        correctChipColor(detected, NO_CORRECTIONS, position, "red"),
      ).toThrow(RangeError);
    }
  });
});
