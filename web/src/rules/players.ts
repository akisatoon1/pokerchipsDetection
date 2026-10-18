import { MAX_PLAYERS } from "./limits";
import type { RuleResult } from "./rule-result";

/** 参加できるかを決めるための, マッチの今の様子. */
export interface JoinState {
  playerCount: number;
  hasRoundStarted: boolean;
}

/**
 * 新しいプレイヤーが参加できるかを判定する.
 *
 * 途中参加は考えないので, 最初のラウンドを始めたあとは参加できない (docs/web/app.md).
 * 人数は MAX_PLAYERS まで.
 * @param state マッチの人数と, ラウンドを始めたか.
 * @returns 参加できれば ok: true. できなければ理由.
 */
export function checkCanJoin(state: JoinState): RuleResult<null> {
  if (state.hasRoundStarted) {
    return { ok: false, reason: "ラウンドが始まったので, もう参加できません" };
  }
  if (state.playerCount >= MAX_PLAYERS) {
    return {
      ok: false,
      reason: `参加できるのは ${String(MAX_PLAYERS)} 人までです`,
    };
  }
  return { ok: true, value: null };
}
