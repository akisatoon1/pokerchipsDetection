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
 * 持ち点を求められない理由. 写真は撮った・選んだ順に, スタックは左から, チップは上から, 1 から数える (画面にそのまま出すため).
 *
 * - noPhoto: 写真が 1 枚もない.
 * - noStack: スタックが 1 つも見つからない写真がある.
 * - countFailed: 枚数を数えられなかったスタックがある.
 * - unknownColor: 色を判定できなかった (`unknown`) チップがある.
 * - unsetColor: 点数を決めていない色のチップがある. 色の判定の誤りか, 設定の漏れのどちらか.
 * - tooLarge: 合計が持ち点の上限 (MAX_POINTS) を超える.
 */
export type ChipPointsProblem =
  | { kind: "noPhoto" }
  | { kind: "noStack"; photoNumber: number }
  | { kind: "countFailed"; photoNumber: number; stackNumber: number }
  | {
      kind: "unknownColor";
      photoNumber: number;
      stackNumber: number;
      chipNumber: number;
    }
  | {
      kind: "unsetColor";
      photoNumber: number;
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
 * 写真ごとの解析の結果と色ごとの点数から, 持ち点を求める. すべての写真のすべてのスタックを合計する.
 *
 * チップが 1 枚の写真に収まらないときに, 分けて撮った写真を合わせて数えるため (docs/web/app.md).
 * 1 つでも数えられないチップや, スタックの見つからない写真があれば止める. 黙って 0 点にすると, 間違いに気づけないため.
 * @param photos 写真ごとの解析の結果. 撮った・選んだ順.
 * @param values 色ごとの点数.
 * @returns 持ち点と色ごとの内訳. 求められなければ, すべての理由.
 */
export function computeChipPoints(
  photos: AnalysisResult[],
  values: ChipValues,
): ChipPointsResult {
  if (photos.length === 0) {
    return { ok: false, problems: [{ kind: "noPhoto" }] };
  }
  const counts = new Map<ChipColorName, number>();
  const problems = photos.flatMap((photo, photoIndex) =>
    countPhoto(photo, photoIndex + 1, values, counts),
  );
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

// 1 枚の写真のチップを, 色ごとに counts に足す. 数えられないものは理由として返す.
function countPhoto(
  photo: AnalysisResult,
  photoNumber: number,
  values: ChipValues,
  counts: Map<ChipColorName, number>,
): ChipPointsProblem[] {
  if (photo.stacks.length === 0) {
    return [{ kind: "noStack", photoNumber }];
  }
  return photo.stacks.flatMap((stack, stackIndex) => {
    const stackNumber = stackIndex + 1;
    if (stack.count === null) {
      return [{ kind: "countFailed", photoNumber, stackNumber }];
    }
    return stack.colors.flatMap((name, chipIndex): ChipPointsProblem[] => {
      const position = { photoNumber, stackNumber, chipNumber: chipIndex + 1 };
      const color = findChipColor(name);
      if (color === null) {
        return [{ kind: "unknownColor", ...position }];
      }
      if (!values.has(color.name)) {
        return [{ kind: "unsetColor", ...position, color }];
      }
      counts.set(color.name, (counts.get(color.name) ?? 0) + 1);
      return [];
    });
  });
}
