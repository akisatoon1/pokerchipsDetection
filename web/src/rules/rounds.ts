import { MIN_PLAYERS_TO_START_ROUND } from "./limits";
import type { RuleResult } from "./rule-result";

/** ラウンドを始められるかを決めるための, マッチの今の様子. */
export interface StartRoundState {
  playerCount: number;
  hasOpenRound: boolean;
}

/**
 * 新しいラウンドを始められるかを判定する.
 *
 * 入力中のラウンドは常に 1 つだけにする. 確定するまで次のラウンドは始められない (docs/web/app.md).
 * @param state マッチの人数と, 入力中のラウンドがあるか.
 * @returns 始められれば ok: true. 始められなければ理由.
 */
export function checkCanStartRound(state: StartRoundState): RuleResult<null> {
  if (state.hasOpenRound) {
    return {
      ok: false,
      reason: "入力中のラウンドを確定してから始めてください",
    };
  }
  if (state.playerCount < MIN_PLAYERS_TO_START_ROUND) {
    return {
      ok: false,
      reason: `ラウンドは ${String(MIN_PLAYERS_TO_START_ROUND)} 人以上で始めてください`,
    };
  }
  return { ok: true, value: null };
}
