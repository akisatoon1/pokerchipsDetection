import { describe, expect, it } from "vitest";
import type { AnalysisResult, StackResult } from "../src/rules/analysis-result";
import { computeChipPoints } from "../src/rules/chip-points";
import {
  findChipColor,
  type ChipColor,
  type ChipColorName,
} from "../src/rules/chip-values";
import { MAX_POINTS } from "../src/rules/limits";

const values = new Map<ChipColorName, number>([
  ["red", 100],
  ["blue", 500],
  ["gray", 10],
]);

function stack(
  colors: string[],
  count: number | null = colors.length,
): StackResult {
  return {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    score: 0.9,
    count,
    peaks: [],
    colors,
  };
}

function result(...stacks: StackResult[]): AnalysisResult {
  return { stacks };
}

function color(name: ChipColorName): ChipColor {
  const found = findChipColor(name);
  if (found === null) {
    throw new Error(`色がありません: ${name}`);
  }
  return found;
}

describe("チップから持ち点を求める (写真 1 枚)", () => {
  it("1 つのスタックの持ち点は, 枚数 × 点数の和になる", () => {
    expect(
      computeChipPoints([result(stack(["red", "blue", "red"]))], values),
    ).toMatchObject({
      ok: true,
      total: 700,
    });
  });

  it("スタックが複数あれば合計する", () => {
    const computed = computeChipPoints(
      [result(stack(["red", "red"]), stack(["blue"]), stack(["gray"]))],
      values,
    );
    expect(computed).toMatchObject({ ok: true, total: 710 });
  });

  it("内訳は色の一覧の順で, 1 枚以上ある色だけを返す", () => {
    const computed = computeChipPoints(
      [result(stack(["gray", "blue"]), stack(["red", "red", "gray"]))],
      values,
    );
    expect(computed).toEqual({
      ok: true,
      total: 720,
      subtotals: [
        { color: color("red"), count: 2, pointsEach: 100, subtotal: 200 },
        { color: color("blue"), count: 1, pointsEach: 500, subtotal: 500 },
        { color: color("gray"), count: 2, pointsEach: 10, subtotal: 20 },
      ],
    });
  });

  it("スタックが 1 つも見つからなければ, 写真の番号を返して止める", () => {
    expect(computeChipPoints([result()], values)).toEqual({
      ok: false,
      problems: [{ kind: "noStack", photoNumber: 1 }],
    });
  });

  it("枚数を数えられなかったスタックがあれば, その番号を返して止める", () => {
    expect(
      computeChipPoints([result(stack(["red"]), stack([], null))], values),
    ).toEqual({
      ok: false,
      problems: [{ kind: "countFailed", photoNumber: 1, stackNumber: 2 }],
    });
  });

  it("色が unknown のチップがあれば, スタックの番号と何枚目かを返して止める", () => {
    expect(
      computeChipPoints([result(stack(["red", "unknown", "blue"]))], values),
    ).toEqual({
      ok: false,
      problems: [
        { kind: "unknownColor", photoNumber: 1, stackNumber: 1, chipNumber: 2 },
      ],
    });
  });

  it("点数を決めていない色のチップがあれば, その色も返して止める", () => {
    expect(
      computeChipPoints([result(stack(["red"]), stack(["green"]))], values),
    ).toEqual({
      ok: false,
      problems: [
        {
          kind: "unsetColor",
          photoNumber: 1,
          stackNumber: 2,
          chipNumber: 1,
          color: color("green"),
        },
      ],
    });
  });

  it("合計が 1,000,000,000 ちょうどなら求められ, 超えると止める", () => {
    const big = new Map<ChipColorName, number>([["red", MAX_POINTS]]);
    expect(computeChipPoints([result(stack(["red"]))], big)).toEqual({
      ok: true,
      total: 1_000_000_000,
      subtotals: [
        {
          color: color("red"),
          count: 1,
          pointsEach: MAX_POINTS,
          subtotal: MAX_POINTS,
        },
      ],
    });
    expect(computeChipPoints([result(stack(["red", "red"]))], big)).toEqual({
      ok: false,
      problems: [{ kind: "tooLarge", total: 2_000_000_000 }],
    });
  });

  it("止める理由が複数あれば, すべて返す", () => {
    const computed = computeChipPoints(
      [
        result(
          stack(["red", "unknown"]),
          stack([], null),
          stack(["purple", "unknown"]),
        ),
      ],
      values,
    );
    expect(computed).toEqual({
      ok: false,
      problems: [
        { kind: "unknownColor", photoNumber: 1, stackNumber: 1, chipNumber: 2 },
        { kind: "countFailed", photoNumber: 1, stackNumber: 2 },
        {
          kind: "unsetColor",
          photoNumber: 1,
          stackNumber: 3,
          chipNumber: 1,
          color: color("purple"),
        },
        { kind: "unknownColor", photoNumber: 1, stackNumber: 3, chipNumber: 2 },
      ],
    });
  });
});

describe("チップから持ち点を求める (写真が複数枚)", () => {
  it("すべての写真のチップの枚数 × 点数を合計する", () => {
    const computed = computeChipPoints(
      [result(stack(["red", "red"])), result(stack(["blue"]), stack(["gray"]))],
      values,
    );
    expect(computed).toMatchObject({ ok: true, total: 710 });
  });

  it("内訳の枚数は, すべての写真の同じ色を足したものになる", () => {
    const computed = computeChipPoints(
      [result(stack(["red", "blue"])), result(stack(["red", "red"]))],
      values,
    );
    expect(computed).toEqual({
      ok: true,
      total: 800,
      subtotals: [
        { color: color("red"), count: 3, pointsEach: 100, subtotal: 300 },
        { color: color("blue"), count: 1, pointsEach: 500, subtotal: 500 },
      ],
    });
  });

  it("写真が 1 枚もなければ止める", () => {
    expect(computeChipPoints([], values)).toEqual({
      ok: false,
      problems: [{ kind: "noPhoto" }],
    });
  });

  it("スタックが見つからない写真があれば, その写真の番号を返して止める", () => {
    expect(
      computeChipPoints([result(stack(["red"])), result()], values),
    ).toEqual({
      ok: false,
      problems: [{ kind: "noStack", photoNumber: 2 }],
    });
  });

  it("数えられないものは, 写真の番号, スタックの番号, 何枚目かを返して止める", () => {
    const computed = computeChipPoints(
      [
        result(stack(["red"])),
        result(stack([], null)),
        result(stack(["blue"]), stack(["blue", "unknown", "green"])),
      ],
      values,
    );
    expect(computed).toEqual({
      ok: false,
      problems: [
        { kind: "countFailed", photoNumber: 2, stackNumber: 1 },
        { kind: "unknownColor", photoNumber: 3, stackNumber: 2, chipNumber: 2 },
        {
          kind: "unsetColor",
          photoNumber: 3,
          stackNumber: 2,
          chipNumber: 3,
          color: color("green"),
        },
      ],
    });
  });

  it("すべての写真の合計が上限を超えたら止める", () => {
    const big = new Map<ChipColorName, number>([["red", MAX_POINTS]]);
    expect(
      computeChipPoints([result(stack(["red"])), result(stack(["red"]))], big),
    ).toEqual({
      ok: false,
      problems: [{ kind: "tooLarge", total: 2_000_000_000 }],
    });
  });
});
