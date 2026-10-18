import { checkCanJoin } from "../../rules/players";
import { checkCanStartRound } from "../../rules/rounds";
import { scoreRound } from "../../rules/scoring";
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
 * 結果を見る API の応答を作る.
 *
 * 増減や, 参加・ラウンドの開始ができるかは規則で計算して入れる. 画面が規則を持たずに済むようにするため.
 * @param data DB から読んだマッチ, プレイヤー, ラウンド, 持ち点.
 * @returns 応答の本文.
 */
export function buildMatchView(data: MatchData) {
  const { match, players, rounds, entries } = data;
  const playerIds = players.map((player) => player.id);
  const roundViews = rounds.map((round) => {
    const pointsByPlayer = new Map(
      entries
        .filter((entry) => entry.roundId === round.id)
        .map((entry) => [entry.playerId, entry.points]),
    );
    return {
      ...round,
      ...scoreRound({
        initialPoints: match.initialPoints,
        playerIds,
        pointsByPlayer,
      }),
    };
  });
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
  };
}
