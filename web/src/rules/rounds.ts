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

/** ラウンドを確定できるかを決めるための, ラウンドの今の様子. */
export interface CloseRoundState {
  isOpen: boolean;
  // 全員の持ち点がそろっているか.
  isComplete: boolean;
}

/**
 * ラウンドを確定できるかを判定する.
 *
 * 全員の持ち点がそろっていれば確定できる. 合計が合わなくても確定はできる.
 * そのまま確定するかはリーダーが選ぶため (docs/web/scoring.md).
 * @param state ラウンドが入力中か, 持ち点がそろっているか.
 * @returns 確定できれば ok: true. できなければ理由.
 */
export function checkCanCloseRound(state: CloseRoundState): RuleResult<null> {
  if (!state.isOpen) {
    return { ok: false, reason: "このラウンドはもう確定しています" };
  }
  if (!state.isComplete) {
    return { ok: false, reason: "全員の持ち点がそろってから確定してください" };
  }
  return { ok: true, value: null };
}
