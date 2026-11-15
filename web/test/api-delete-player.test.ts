import { describe, expect, it } from "vitest";
import {
  createMatch,
  deletePlayer,
  joinMatch,
  matchWithOpenRound,
  readMatch,
  renamePlayer,
  send,
} from "./helpers";

// リーダー A と, 参加した B, C のマッチ. まだラウンドは始めていない.
async function matchBeforeRound() {
  const leader = await createMatch({ leaderName: "A" });
  const playerB = await joinMatch(leader.matchId, "B");
  const playerC = await joinMatch(leader.matchId, "C");
  return { leader, playerB, playerC };
}

async function namesOf(matchId: string) {
  const match = await readMatch(matchId);
  return match.players.map((player) => player.name);
}

describe("プレイヤーを削除する", () => {
  it("リーダーのトークンなら削除でき, マッチを読むとその人がいない", async () => {
    const { leader, playerB } = await matchBeforeRound();
    const response = await deletePlayer(
      leader.matchId,
      playerB.playerId,
      leader.token,
    );
    expect(response.status).toBe(204);
    expect(await namesOf(leader.matchId)).toEqual(["A", "C"]);
  });

  it("リーダーでないプレイヤーのトークンなら拒否する", async () => {
    const { leader, playerB, playerC } = await matchBeforeRound();
    const response = await deletePlayer(
      leader.matchId,
      playerC.playerId,
      playerB.token,
    );
    expect(response.status).toBe(403);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("トークンがない, または別のマッチのトークンなら拒否する", async () => {
    const { leader, playerB } = await matchBeforeRound();
    const other = await createMatch();
    expect((await deletePlayer(leader.matchId, playerB.playerId)).status).toBe(
      401,
    );
    expect(
      (await deletePlayer(leader.matchId, playerB.playerId, other.token))
        .status,
    ).toBe(401);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("最初のラウンドを始めたあとは拒否する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await deletePlayer(
      leader.matchId,
      playerB.playerId,
      leader.token,
    );
    expect(response.status).toBe(409);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("リーダーを削除しようとしたら拒否する", async () => {
    const { leader } = await matchBeforeRound();
    const response = await deletePlayer(
      leader.matchId,
      leader.playerId,
      leader.token,
    );
    expect(response.status).toBe(409);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("いないプレイヤーや, 別のマッチのプレイヤーなら 404", async () => {
    const { leader } = await matchBeforeRound();
    const other = await createMatch();
    const otherPlayer = await joinMatch(other.matchId, "X");
    expect(
      (await deletePlayer(leader.matchId, "no-such-player", leader.token))
        .status,
    ).toBe(404);
    expect(
      (await deletePlayer(leader.matchId, otherPlayer.playerId, leader.token))
        .status,
    ).toBe(404);
    expect(await namesOf(other.matchId)).toContain("X");
  });

  it("マッチがなければ 404", async () => {
    const { leader, playerB } = await matchBeforeRound();
    const response = await deletePlayer(
      "no-such-match",
      playerB.playerId,
      leader.token,
    );
    expect(response.status).toBe(404);
  });

  it("削除された人のトークンでは, 名前を変えられない", async () => {
    const { leader, playerB } = await matchBeforeRound();
    await deletePlayer(leader.matchId, playerB.playerId, leader.token);
    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      "戻った",
      playerB.token,
    );
    expect(response.status).toBe(401);
  });

  it("削除したあと, 同じ名前で参加し直せる", async () => {
    const { leader, playerB } = await matchBeforeRound();
    await deletePlayer(leader.matchId, playerB.playerId, leader.token);
    const response = await send(`/api/matches/${leader.matchId}/players`, {
      method: "POST",
      body: { name: "B" },
    });
    expect(response.status).toBe(201);
    expect(await namesOf(leader.matchId)).toEqual(["A", "C", "B"]);
  });

  it("3 人のうち 2 番目を消したあとも新しい人が参加でき, 参加した順に並ぶ", async () => {
    const { leader, playerB } = await matchBeforeRound();
    await deletePlayer(leader.matchId, playerB.playerId, leader.token);
    await joinMatch(leader.matchId, "D");
    await joinMatch(leader.matchId, "E");
    expect(await namesOf(leader.matchId)).toEqual(["A", "C", "D", "E"]);
  });
});
