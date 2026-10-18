import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  createMatch,
  matchWithOpenRound,
  putEntry,
  readMatch,
  send,
} from "./helpers";

async function roundOf(matchId: string) {
  const match = await readMatch(matchId);
  const round = match.rounds[0];
  if (round === undefined) {
    throw new Error("ラウンドがない");
  }
  return round;
}

describe("持ち点を入れる・直す", () => {
  it("本人のトークンなら保存でき, もう一度送れば上書きされる", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    expect(
      (await putEntry(roundId, playerB.playerId, 120, playerB.token)).status,
    ).toBe(200);
    expect(
      (await putEntry(roundId, playerB.playerId, 80, playerB.token)).status,
    ).toBe(200);
    const round = await roundOf(leader.matchId);
    expect(round.scores[1]).toEqual({
      playerId: playerB.playerId,
      points: 80,
      delta: -20,
    });
  });

  it("他人の playerId に送ったら拒否する", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    const response = await putEntry(
      roundId,
      leader.playerId,
      500,
      playerB.token,
    );
    expect(response.status).toBe(403);
    expect((await roundOf(leader.matchId)).scores[0]?.points).toBeNull();
  });

  it("リーダーでも他人の持ち点は入れられない", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    const response = await putEntry(
      roundId,
      playerB.playerId,
      500,
      leader.token,
    );
    expect(response.status).toBe(403);
  });

  it("トークンがなければ拒否する", async () => {
    const { playerB, roundId } = await matchWithOpenRound();
    expect((await putEntry(roundId, playerB.playerId, 100)).status).toBe(401);
  });

  it("別のマッチのラウンドに送ったら拒否する", async () => {
    const { roundId } = await matchWithOpenRound();
    const other = await createMatch();
    const response = await putEntry(roundId, other.playerId, 100, other.token);
    expect(response.status).toBe(401);
  });

  it.each([
    ["負の数", -1],
    ["小数", 10.5],
    ["文字列", "100"],
    ["1,000,000,001", 1_000_000_001],
  ])("持ち点が%sなら拒否する", async (_label, points) => {
    const { playerB, roundId } = await matchWithOpenRound();
    const response = await putEntry(
      roundId,
      playerB.playerId,
      points,
      playerB.token,
    );
    expect(response.status).toBe(400);
  });

  it("持ち点が 0 と 1,000,000,000 なら受け付ける", async () => {
    const { playerB, roundId } = await matchWithOpenRound();
    expect(
      (await putEntry(roundId, playerB.playerId, 0, playerB.token)).status,
    ).toBe(200);
    expect(
      (await putEntry(roundId, playerB.playerId, 1_000_000_000, playerB.token))
        .status,
    ).toBe(200);
  });

  it("確定したラウンドへの入力は拒否する", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    await putEntry(roundId, playerB.playerId, 100, playerB.token);
    // 確定の API は次の機能で作るので, ここでは DB を直接変える.
    await env.DB.prepare("UPDATE rounds SET status = 'closed' WHERE id = ?")
      .bind(roundId)
      .run();
    const response = await putEntry(
      roundId,
      playerB.playerId,
      50,
      playerB.token,
    );
    expect(response.status).toBe(409);
    expect((await roundOf(leader.matchId)).scores[1]?.points).toBe(100);
  });

  it("存在しないラウンドなら 404 を返す", async () => {
    const { playerB } = await matchWithOpenRound();
    const response = await putEntry(
      "no-such-round",
      playerB.playerId,
      100,
      playerB.token,
    );
    expect(response.status).toBe(404);
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const { playerB, roundId } = await matchWithOpenRound();
    const response = await send(
      `/api/rounds/${roundId}/entries/${playerB.playerId}`,
      {
        method: "PUT",
        body: { points: 100, delta: 0 },
        token: playerB.token,
      },
    );
    expect(response.status).toBe(400);
  });
});

describe("確定前の表示", () => {
  it("増減は持ち点 − 初期点数で, 入れていない人は未入力になる", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    await putEntry(roundId, playerB.playerId, 130, playerB.token);
    const round = await roundOf(leader.matchId);
    expect(round.scores.map((score) => score.delta)).toEqual([null, 30, null]);
    expect(round.isComplete).toBe(false);
    expect(round.hasTotalMismatch).toBe(false);
  });

  it("全員がそろい, 合計が S × n でなければ警告の印が付く", async () => {
    const { leader, playerB, playerC, roundId } = await matchWithOpenRound();
    await putEntry(roundId, leader.playerId, 100, leader.token);
    await putEntry(roundId, playerB.playerId, 100, playerB.token);
    await putEntry(roundId, playerC.playerId, 99, playerC.token);
    const round = await roundOf(leader.matchId);
    expect(round.isComplete).toBe(true);
    expect(round.hasTotalMismatch).toBe(true);
    expect(round.totalPoints).toBe(299);
    expect(round.expectedTotalPoints).toBe(300);
  });

  it("全員がそろい, 合計が合えば警告の印は付かない", async () => {
    const { leader, playerB, playerC, roundId } = await matchWithOpenRound();
    await putEntry(roundId, leader.playerId, 150, leader.token);
    await putEntry(roundId, playerB.playerId, 150, playerB.token);
    await putEntry(roundId, playerC.playerId, 0, playerC.token);
    const round = await roundOf(leader.matchId);
    expect(round.hasTotalMismatch).toBe(false);
  });
});
