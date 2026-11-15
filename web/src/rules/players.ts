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

/** プレイヤーを削除できるかを決めるための, マッチの今の様子. */
export interface RemoveState {
  hasRoundStarted: boolean;
  /** 削除しようとしている人がリーダーか. */
  isLeaderTarget: boolean;
}

/**
 * リーダーがプレイヤーを削除できるかを判定する.
 *
 * 最初のラウンドを始めたあとは削除できない. 人数 n はそこで固まり, 合計の検査 (Σp = S × n) と
 * 確定したラウンドの増減は n で成り立つため (docs/web/app.md).
 * リーダー自身は削除できない. マッチにリーダーがいなくなるため.
 * @param state ラウンドを始めたかと, 削除しようとしている人がリーダーか.
 * @returns 削除できれば ok: true. できなければ理由.
 */
export function checkCanRemovePlayer(state: RemoveState): RuleResult<null> {
  if (state.hasRoundStarted) {
    return {
      ok: false,
      reason: "ラウンドが始まったので, もうプレイヤーを削除できません",
    };
  }
  if (state.isLeaderTarget) {
    return { ok: false, reason: "リーダーは削除できません" };
  }
  return { ok: true, value: null };
}
