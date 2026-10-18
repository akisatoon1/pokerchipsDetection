import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  closeRound,
  createMatch,
  deleteMatch,
  joinMatch,
  matchWithOpenRound,
  putEntry,
  send,
  startRound,
} from "./helpers";

// マッチに属する行の数を, 表ごとに数える. 削除で何も残らないことを確かめるため.
async function countRows(matchId: string) {
  const count = async (sql: string) => {
    const row = await env.DB.prepare(sql)
      .bind(matchId)
      .first<{ count: number }>();
    return row?.count;
  };
  return {
    matches: await count("SELECT COUNT(*) AS count FROM matches WHERE id = ?"),
    players: await count(
      "SELECT COUNT(*) AS count FROM players WHERE match_id = ?",
    ),
    rounds: await count(
      "SELECT COUNT(*) AS count FROM rounds WHERE match_id = ?",
    ),
    entries: await count(
      "SELECT COUNT(*) AS count FROM entries WHERE round_id IN (SELECT id FROM rounds WHERE match_id = ?)",
    ),
  };
}

// 確定したラウンドと, 入力中のラウンドを持つマッチを作る.
async function matchWithRounds() {
  const { leader, playerB, playerC, roundId } = await matchWithOpenRound();
  await putEntry(roundId, leader.playerId, 100, leader.token);
  await putEntry(roundId, playerB.playerId, 100, playerB.token);
  await putEntry(roundId, playerC.playerId, 100, playerC.token);
  await closeRound(roundId, leader.token);
  const started = await startRound(leader.matchId, leader.token);
  const { roundId: openRoundId } = await started.json<{ roundId: string }>();
  await putEntry(openRoundId, playerB.playerId, 150, playerB.token);
  return { leader, playerB, playerC, openRoundId };
}

describe("マッチを削除する", () => {
  it("リーダーのトークンなら削除でき, そのあと読むと 404 になる", async () => {
    const leader = await createMatch();
    const response = await deleteMatch(leader.matchId, leader.token);
    expect(response.status).toBe(204);
    expect((await send(`/api/matches/${leader.matchId}`)).status).toBe(404);
  });

  it("プレイヤー, ラウンド, 持ち点も DB から消える", async () => {
    const { leader } = await matchWithRounds();
    expect(await countRows(leader.matchId)).toEqual({
      matches: 1,
      players: 3,
      rounds: 2,
      entries: 4,
    });
    await deleteMatch(leader.matchId, leader.token);
    expect(await countRows(leader.matchId)).toEqual({
      matches: 0,
      players: 0,
      rounds: 0,
      entries: 0,
    });
  });

  it("別のマッチは消えない", async () => {
    const { leader } = await matchWithRounds();
    const other = await matchWithRounds();
    await deleteMatch(leader.matchId, leader.token);
    expect(await countRows(other.leader.matchId)).toEqual({
      matches: 1,
      players: 3,
      rounds: 2,
      entries: 4,
    });
  });

  it("入力中のラウンドがあっても削除できる", async () => {
    const { leader } = await matchWithRounds();
    expect((await deleteMatch(leader.matchId, leader.token)).status).toBe(204);
  });

  it("リーダーでないプレイヤーのトークンなら 403 を返し, 何も消えない", async () => {
    const { leader, playerB } = await matchWithRounds();
    const response = await deleteMatch(leader.matchId, playerB.token);
    expect(response.status).toBe(403);
    expect(await countRows(leader.matchId)).toEqual({
      matches: 1,
      players: 3,
      rounds: 2,
      entries: 4,
    });
  });

  it("トークンがなければ 401 を返す", async () => {
    const leader = await createMatch();
    expect((await deleteMatch(leader.matchId)).status).toBe(401);
    expect((await send(`/api/matches/${leader.matchId}`)).status).toBe(200);
  });

  it("別のマッチのトークンなら 401 を返す", async () => {
    const leader = await createMatch();
    const other = await createMatch();
    expect((await deleteMatch(leader.matchId, other.token)).status).toBe(401);
    expect((await send(`/api/matches/${leader.matchId}`)).status).toBe(200);
  });

  it("ないマッチなら 404 を返す", async () => {
    const leader = await createMatch();
    expect((await deleteMatch("no-such-match", leader.token)).status).toBe(404);
  });

  it("削除したあと, 元のプレイヤーのトークンでは持ち点を入れられず, 参加もできない", async () => {
    const { leader, playerC, openRoundId } = await matchWithRounds();
    await deleteMatch(leader.matchId, leader.token);
    const response = await putEntry(
      openRoundId,
      playerC.playerId,
      50,
      playerC.token,
    );
    expect(response.status).toBe(404);
    await expect(joinMatch(leader.matchId, "D")).rejects.toThrow();
  });
});
