import { checkCanJoin } from "../../rules/players";
import { checkCanStartRound } from "../../rules/rounds";
import {
  computeTotals,
  scoreRound,
  type RoundScore,
} from "../../rules/scoring";
import type { EntryRecord } from "../db/entries";
import type { MatchRecord } from "../db/matches";
import type { PlayerRecord } from "../db/players";
import type { RoundRecord } from "../db/rounds";

/** 結果の応答を作るのに要る, DB から読んだもの. */
export interface MatchData {
  match: MatchRecord;
  players: PlayerRecord[];
  rounds: RoundRecord[];
  entries: EntryRecord[];
}

/**
 * DB から読んだ持ち点から, 1 つのラウンドの増減と合計の検査を計算する.
 *
 * @param match マッチ. 初期点数を使う.
 * @param players マッチのプレイヤー. この順に結果を並べる.
 * @param entries マッチの持ち点. 他のラウンドのものが混ざっていてよい.
 * @param roundId 計算するラウンドの id.
 * @returns ラウンドの結果.
 */
export function scoreRoundFromRecords(
  match: MatchRecord,
  players: readonly PlayerRecord[],
  entries: readonly EntryRecord[],
  roundId: string,
): RoundScore {
  return scoreRound({
    initialPoints: match.initialPoints,
    playerIds: players.map((player) => player.id),
    pointsByPlayer: new Map(
      entries
        .filter((entry) => entry.roundId === roundId)
        .map((entry) => [entry.playerId, entry.points]),
    ),
  });
}

/**
 * 結果を見る API の応答を作る.
 *
 * 増減や, 参加・ラウンドの開始ができるかは規則で計算して入れる. 画面が規則を持たずに済むようにするため.
 * @param data DB から読んだマッチ, プレイヤー, ラウンド, 持ち点.
 * @returns 応答の本文.
 */
export function buildMatchView(data: MatchData) {
  const { match, players, rounds, entries } = data;
  const playerIds = players.map((player) => player.id);
  const roundViews = rounds.map((round) => ({
    ...round,
    ...scoreRoundFromRecords(match, players, entries, round.id),
  }));
  const totals = computeTotals(
    playerIds,
    roundViews.map((round) => ({
      isClosed: round.status === "closed",
      scores: round.scores,
    })),
  );
  const canJoin = checkCanJoin({
    playerCount: players.length,
    hasRoundStarted: rounds.length > 0,
  });
  const canStartRound = checkCanStartRound({
    playerCount: players.length,
    hasOpenRound: rounds.some((round) => round.status === "open"),
  });
  return {
    id: match.id,
    name: match.name,
    initialPoints: match.initialPoints,
    leaderPlayerId: match.leaderPlayerId,
    isJoinOpen: canJoin.ok,
    canStartRound: canStartRound.ok,
    players,
    rounds: roundViews,
    totals,
  };
}
