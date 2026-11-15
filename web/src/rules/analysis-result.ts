import { z } from "zod";
import type { RuleResult } from "./rule-result";

/**
 * 1 つのスタックの解析の結果. 座標は元画像のピクセル.
 *
 * core の toJson の 1 つのスタックに当たる (Android の AnalysisResult.kt と同じ形).
 */
export interface StackResult {
  /** スタックの枠の左上の x. */
  x: number;
  /** スタックの枠の左上の y. */
  y: number;
  /** スタックの枠の幅. */
  width: number;
  /** スタックの枠の高さ. */
  height: number;
  /** 検出のスコア. */
  score: number;
  /** 枚数. 数えられなければ null. */
  count: number | null;
  /** チップの合わせ目の y. 元画像でなく, 枠の上端からのピクセル. 数えられなければ空. */
  peaks: number[];
  /** 上のチップから順の色の名前 (core の chipColorName). */
  colors: string[];
}

/** 画像 1 枚の解析の結果. スタックは左から順に並ぶ. */
export interface AnalysisResult {
  stacks: StackResult[];
}

const pixel = z.number().int();

const stackSchema = z
  .object({
    box: z.tuple([pixel, pixel, pixel, pixel]),
    score: z.number(),
    count: z.number().int().nullable(),
    peaks: z.array(pixel),
    colors: z.array(z.string()),
  })
  .strict();

const analysisSchema = z.object({ stacks: z.array(stackSchema) }).strict();

/**
 * core が返した JSON (toJson の形) を読む.
 *
 * WASM から来る値も外からの入力として扱い, 形を確かめてから使う. core と画面の版がずれたときに,
 * 黙って間違った値を出さないため.
 * @param json core の toJson が作った文字.
 * @returns 解析の結果. JSON でない, または形が違えば ok: false と理由.
 */
export function parseAnalysisResult(json: string): RuleResult<AnalysisResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "解析の結果を読めませんでした" };
  }
  const checked = analysisSchema.safeParse(parsed);
  if (!checked.success) {
    return { ok: false, reason: "解析の結果の形が違います" };
  }
  const stacks = checked.data.stacks.map((stack) => {
    const [x, y, width, height] = stack.box;
    return {
      x,
      y,
      width,
      height,
      score: stack.score,
      count: stack.count,
      peaks: stack.peaks,
      colors: stack.colors,
    };
  });
  return { ok: true, value: { stacks } };
}
