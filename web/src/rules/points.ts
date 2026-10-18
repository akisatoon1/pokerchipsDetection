import { MAX_POINTS } from "./limits";
import type { RuleResult } from "./rule-result";

/**
 * 初期点数 S が決まりを満たすかを確かめる.
 *
 * S は 1 以上 MAX_POINTS 以下の整数 (docs/web/scoring.md).
 * @param initialPoints 利用者が入れた初期点数.
 * @returns そのままの値. 決まりを満たさなければ ok: false と理由.
 */
export function validateInitialPoints(
  initialPoints: number,
): RuleResult<number> {
  if (
    !Number.isInteger(initialPoints) ||
    initialPoints < 1 ||
    initialPoints > MAX_POINTS
  ) {
    return {
      ok: false,
      reason: `初期点数は 1 以上 ${String(MAX_POINTS)} 以下の整数にしてください`,
    };
  }
  return { ok: true, value: initialPoints };
}

/**
 * 持ち点 p が決まりを満たすかを確かめる.
 *
 * p は 0 以上 MAX_POINTS 以下の整数 (docs/web/scoring.md). チップの点数は整数なので小数は扱わない.
 * @param points 利用者が入れた持ち点.
 * @returns そのままの値. 決まりを満たさなければ ok: false と理由.
 */
export function validatePoints(points: number): RuleResult<number> {
  if (!Number.isInteger(points) || points < 0 || points > MAX_POINTS) {
    return {
      ok: false,
      reason: `持ち点は 0 以上 ${String(MAX_POINTS)} 以下の整数にしてください`,
    };
  }
  return { ok: true, value: points };
}
