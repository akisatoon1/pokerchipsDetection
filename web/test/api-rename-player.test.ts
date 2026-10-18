import { describe, expect, it } from "vitest";
import {
  closeRound,
  createMatch,
  matchWithOpenRound,
  putEntry,
  readMatch,
  renamePlayer,
  send,
} from "./helpers";

async function namesOf(matchId: string) {
  const match = await readMatch(matchId);
  return match.players.map((player) => player.name);
}

describe("名前を変える", () => {
  it("本人なら変えられ, 前後の空白を除いて保存する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      " ビー ",
      playerB.token,
    );
    expect(response.status).toBe(200);
    expect(await namesOf(leader.matchId)).toEqual(["A", "ビー", "C"]);
  });

  it("他人のトークンでは変えられない", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      "乗っ取り",
      leader.token,
    );
    expect(response.status).toBe(403);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("トークンがないときと, 別のマッチのトークンのときは拒否する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const other = await createMatch();
    expect(
      (await renamePlayer(leader.matchId, playerB.playerId, "X")).status,
    ).toBe(401);
    expect(
      (await renamePlayer(leader.matchId, playerB.playerId, "X", other.token))
        .status,
    ).toBe(401);
  });

  it("名前の決まりを満たさなければ拒否する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    for (const name of ["", "  ", "あ".repeat(21)]) {
      const response = await renamePlayer(
        leader.matchId,
        playerB.playerId,
        name,
        playerB.token,
      );
      expect(response.status).toBe(400);
    }
  });

  it("他の人と重なれば拒否する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      "C",
      playerB.token,
    );
    expect(response.status).toBe(409);
    expect(await namesOf(leader.matchId)).toEqual(["A", "B", "C"]);
  });

  it("自分の今の名前と同じなら受け付ける", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      "B",
      playerB.token,
    );
    expect(response.status).toBe(200);
  });

  it("ラウンドを始めたあとでも変えられ, 確定したラウンドも新しい名前で表示される", async () => {
    const { leader, playerB, playerC, roundId } = await matchWithOpenRound();
    await putEntry(roundId, leader.playerId, 100, leader.token);
    await putEntry(roundId, playerB.playerId, 120, playerB.token);
    await putEntry(roundId, playerC.playerId, 80, playerC.token);
    await closeRound(roundId, leader.token);

    const response = await renamePlayer(
      leader.matchId,
      playerB.playerId,
      "ビー",
      playerB.token,
    );
    expect(response.status).toBe(200);
    const match = await readMatch(leader.matchId);
    const nameOfB = match.players.find(
      (player) => player.id === playerB.playerId,
    )?.name;
    expect(nameOfB).toBe("ビー");
    // ラウンドの結果は id で持つので, 表示の名前は players から引かれ, 計算は変わらない.
    expect(match.rounds[0]?.scores[1]).toEqual({
      playerId: playerB.playerId,
      points: 120,
      delta: 20,
    });
    expect(match.totals[1]).toEqual({ playerId: playerB.playerId, total: 20 });
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const { leader, playerB } = await matchWithOpenRound();
    const response = await send(
      `/api/matches/${leader.matchId}/players/${playerB.playerId}`,
      {
        method: "PATCH",
        body: { name: "X", isLeader: true },
        token: playerB.token,
      },
    );
    expect(response.status).toBe(400);
  });

  it("存在しないマッチなら 404 を返す", async () => {
    const { playerB } = await matchWithOpenRound();
    const response = await renamePlayer(
      "no-such-match",
      playerB.playerId,
      "X",
      playerB.token,
    );
    expect(response.status).toBe(404);
  });
});
