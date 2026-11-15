import type { AnalysisResult } from "./analysis-result";
import {
  CHIP_COLORS,
  findChipColor,
  type ChipColor,
  type ChipColorName,
  type ChipValues,
} from "./chip-values";
import { MAX_POINTS } from "./limits";

/** 1 つの色の内訳. */
export interface ColorSubtotal {
  color: ChipColor;
  /** 枚数 (すべてのスタックの合計). */
  count: number;
  /** チップ 1 枚の点数. */
  pointsEach: number;
  /** 枚数 × 点数. */
  subtotal: number;
}

/**
 * 持ち点を求められない理由. スタックは左から, チップは上から, 1 から数える (画面にそのまま出すため).
 *
 * - noStack: スタックが 1 つも見つからない.
 * - countFailed: 枚数を数えられなかったスタックがある.
 * - unknownColor: 色を判定できなかった (`unknown`) チップがある.
 * - unsetColor: 点数を決めていない色のチップがある. 色の判定の誤りか, 設定の漏れのどちらか.
 * - tooLarge: 合計が持ち点の上限 (MAX_POINTS) を超える.
 */
export type ChipPointsProblem =
  | { kind: "noStack" }
  | { kind: "countFailed"; stackNumber: number }
  | { kind: "unknownColor"; stackNumber: number; chipNumber: number }
  | {
      kind: "unsetColor";
      stackNumber: number;
      chipNumber: number;
      color: ChipColor;
    }
  | { kind: "tooLarge"; total: number };

/**
 * チップから持ち点を求めた結果.
 *
 * 求められたら, 持ち点と色ごとの内訳 (色の一覧の順で, 1 枚以上ある色だけ).
 * 求められなければ, すべての理由.
 */
export type ChipPointsResult =
  | { ok: true; total: number; subtotals: ColorSubtotal[] }
  | { ok: false; problems: ChipPointsProblem[] };

/**
 * 解析の結果と色ごとの点数から, 持ち点を求める. スタックが複数あれば合計する (Android の ChipPoints.kt と同じ).
 *
 * 1 つでも数えられないチップがあれば止める. 黙って 0 点にすると, 間違いに気づけないため (docs/web/app.md).
 * @param result 解析の結果.
 * @param values 色ごとの点数.
 * @returns 持ち点と色ごとの内訳. 求められなければ, すべての理由.
 */
export function computeChipPoints(
  result: AnalysisResult,
  values: ChipValues,
): ChipPointsResult {
  if (result.stacks.length === 0) {
    return { ok: false, problems: [{ kind: "noStack" }] };
  }
  const problems: ChipPointsProblem[] = [];
  const counts = new Map<ChipColorName, number>();
  result.stacks.forEach((stack, stackIndex) => {
    const stackNumber = stackIndex + 1;
    if (stack.count === null) {
      problems.push({ kind: "countFailed", stackNumber });
      return;
    }
    stack.colors.forEach((name, chipIndex) => {
      const chipNumber = chipIndex + 1;
      const color = findChipColor(name);
      if (color === null) {
        problems.push({ kind: "unknownColor", stackNumber, chipNumber });
      } else if (!values.has(color.name)) {
        problems.push({ kind: "unsetColor", stackNumber, chipNumber, color });
      } else {
        counts.set(color.name, (counts.get(color.name) ?? 0) + 1);
      }
    });
  });
  const subtotals = CHIP_COLORS.flatMap((color) => {
    const count = counts.get(color.name);
    const pointsEach = values.get(color.name);
    if (count === undefined || pointsEach === undefined) {
      return [];
    }
    return [{ color, count, pointsEach, subtotal: count * pointsEach }];
  });
  // 1 枚の点数も上限までだが, 枚数を掛けて足しても JavaScript の数で誤差なく扱える大きさに収まる.
  const total = subtotals.reduce((sum, item) => sum + item.subtotal, 0);
  if (total > MAX_POINTS) {
    problems.push({ kind: "tooLarge", total });
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return { ok: true, total, subtotals };
}
