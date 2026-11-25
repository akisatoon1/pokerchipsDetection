import type { AnalysisResult } from "./analysis-result";
import type { ChipColorName } from "./chip-values";

/** 写真の中のチップ 1 枚の位置. どちらも 0 から数える (スタックは左から, チップは上から). */
export interface ChipPosition {
  stackIndex: number;
  chipIndex: number;
}

/**
 * 1 枚の写真で, 人が手で直したチップの色. 直していないチップは入らない.
 *
 * core が色を間違えることがあるので, 確認画像を見た人がチップ 1 枚ごとに直せるようにする (docs/web/app.md).
 * 作るのも変えるのも, この型の関数で行う.
 */
export interface ColorCorrections {
  /** 直したチップの位置 (positionKey) から, 直した色へ. */
  readonly colors: ReadonlyMap<string, ChipColorName>;
}

/** 1 枚も直していないもの. 写真を足したときの初めの値. */
export const NO_CORRECTIONS: ColorCorrections = { colors: new Map() };

/**
 * チップ 1 枚の色を直す. 元のものは変えずに, 直したあとのものを返す.
 *
 * 検出のときと同じ色に直したら, 直していないものとして扱う. 直したかどうかの表示を, 実際に色が変わったチップだけに出すため.
 * @param detected 写真の解析の結果 (直す前).
 * @param corrections 今までに直した色.
 * @param position 直すチップ.
 * @param color 直した色.
 * @returns 直したあとの色.
 * @throws RangeError position が解析の結果にないとき. 画面は解析の結果にあるチップからしか直させないので, 作り間違いのため.
 */
export function correctChipColor(
  detected: AnalysisResult,
  corrections: ColorCorrections,
  position: ChipPosition,
  color: ChipColorName,
): ColorCorrections {
  const detectedColor = detectedColorAt(detected, position);
  if (detectedColor === undefined) {
    throw new RangeError(
      `解析の結果にないチップです: スタック ${String(position.stackIndex)}, チップ ${String(position.chipIndex)}`,
    );
  }
  const colors = new Map(corrections.colors);
  if (color === detectedColor) {
    colors.delete(positionKey(position));
  } else {
    colors.set(positionKey(position), color);
  }
  return { colors };
}

/**
 * チップ 1 枚を, 検出のときの色に戻す. 元のものは変えずに, 戻したあとのものを返す.
 *
 * @param corrections 今までに直した色.
 * @param position 戻すチップ. 直していなければ何も変えない.
 * @returns 戻したあとの色.
 */
export function revertChipColor(
  corrections: ColorCorrections,
  position: ChipPosition,
): ColorCorrections {
  const colors = new Map(corrections.colors);
  colors.delete(positionKey(position));
  return { colors };
}

/**
 * チップ 1 枚の直した色を返す.
 *
 * @param corrections 直した色.
 * @param position チップ.
 * @returns 直した色. 直していなければ null.
 */
export function correctedColorAt(
  corrections: ColorCorrections,
  position: ChipPosition,
): ChipColorName | null {
  return corrections.colors.get(positionKey(position)) ?? null;
}

/**
 * 直したチップの枚数.
 *
 * @param corrections 直した色.
 * @returns 枚数.
 */
export function countCorrectedChips(corrections: ColorCorrections): number {
  return corrections.colors.size;
}

/**
 * 解析の結果に直した色を当てる. 持ち点は, これで直した結果から求める.
 *
 * 元の結果は変えない. 直す前の色を, 直したチップの「検出: 青」の表示や, 元に戻すときに使うため.
 * @param detected 写真の解析の結果 (直す前).
 * @param corrections 直した色.
 * @returns 直したチップの色を変えた解析の結果. ほかの値は元のまま.
 */
export function applyColorCorrections(
  detected: AnalysisResult,
  corrections: ColorCorrections,
): AnalysisResult {
  const stacks = detected.stacks.map((stack, stackIndex) => ({
    ...stack,
    colors: stack.colors.map(
      (name, chipIndex) =>
        correctedColorAt(corrections, { stackIndex, chipIndex }) ?? name,
    ),
  }));
  return { stacks };
}

function detectedColorAt(
  detected: AnalysisResult,
  position: ChipPosition,
): string | undefined {
  return detected.stacks[position.stackIndex]?.colors[position.chipIndex];
}

// Map のキーにするため, 位置を 1 つの文字にする.
function positionKey(position: ChipPosition): string {
  return `${String(position.stackIndex)}:${String(position.chipIndex)}`;
}
