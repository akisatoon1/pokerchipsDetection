import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import {
  closeRound,
  createMatch,
  joinMatch,
  matchWithOpenRound,
  putEntry,
  readMatch,
  send,
  startRound,
  updateChipValues,
} from "./helpers";

describe("色ごとの点数を変える", () => {
  it("リーダーが変えると, 新しい点数が返り, 外した色は返らない", async () => {
    const leader = await createMatch({ chipValues: { red: 100, blue: 500 } });
    const response = await updateChipValues(
      leader.matchId,
      { green: 25, red: 200 },
      leader.token,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      chipValues: { red: 200, green: 25 },
    });
    expect((await readMatch(leader.matchId)).chipValues).toEqual({
      red: 200,
      green: 25,
    });
  });

  it("最初のラウンドの前に変えられる", async () => {
    const leader = await createMatch();
    await joinMatch(leader.matchId, "B");
    const response = await updateChipValues(
      leader.matchId,
      { black: 1000 },
      leader.token,
    );
    expect(response.status).toBe(200);
  });

  it("入力中のラウンドがあっても変えられ, 保存済みの持ち点と増減は変わらない", async () => {
    const { leader, playerB, roundId } = await matchWithOpenRound();
    await putEntry(roundId, playerB.playerId, 150, playerB.token);
    const before = await readMatch(leader.matchId);
    const response = await updateChipValues(
      leader.matchId,
      { red: 1, blue: 5 },
      leader.token,
    );
    expect(response.status).toBe(200);
    const after = await readMatch(leader.matchId);
    expect(after.rounds).toEqual(before.rounds);
    expect(after.totals).toEqual(before.totals);
    expect(after.chipValues).toEqual({ red: 1, blue: 5 });
  });

  it("確定したラウンドのあとでも変えられ, 確定した持ち点と累計は変わらない", async () => {
    const { leader, playerB, playerC, roundId } = await matchWithOpenRound();
    await putEntry(roundId, leader.playerId, 50, leader.token);
    await putEntry(roundId, playerB.playerId, 150, playerB.token);
    await putEntry(roundId, playerC.playerId, 100, playerC.token);
    await closeRound(roundId, leader.token);
    await startRound(leader.matchId, leader.token);
    const before = await readMatch(leader.matchId);
    const response = await updateChipValues(
      leader.matchId,
      { purple: 10_000 },
      leader.token,
    );
    expect(response.status).toBe(200);
    const after = await readMatch(leader.matchId);
    expect(after.rounds).toEqual(before.rounds);
    expect(after.totals).toEqual(before.totals);
  });

  it("点数の表に行がないマッチ (この表より前に作ったもの) でも, リーダーが決められる", async () => {
    const leader = await createMatch();
    await env.DB.prepare("DELETE FROM match_chip_values WHERE match_id = ?")
      .bind(leader.matchId)
      .run();
    const response = await updateChipValues(
      leader.matchId,
      { yellow: 50 },
      leader.token,
    );
    expect(response.status).toBe(200);
    expect((await readMatch(leader.matchId)).chipValues).toEqual({
      yellow: 50,
    });
  });

  it("リーダーでないプレイヤーのトークンなら 403 を返し, 点数は変わらない", async () => {
    const leader = await createMatch({ chipValues: { red: 100 } });
    const playerB = await joinMatch(leader.matchId, "B");
    const response = await updateChipValues(
      leader.matchId,
      { red: 1 },
      playerB.token,
    );
    expect(response.status).toBe(403);
    expect((await readMatch(leader.matchId)).chipValues).toEqual({ red: 100 });
  });

  it("トークンがなければ 401 を返す", async () => {
    const leader = await createMatch();
    const response = await updateChipValues(leader.matchId, { red: 1 });
    expect(response.status).toBe(401);
  });

  it("別のマッチのリーダーのトークンなら 401 を返す", async () => {
    const leader = await createMatch();
    const other = await createMatch();
    const response = await updateChipValues(
      leader.matchId,
      { red: 1 },
      other.token,
    );
    expect(response.status).toBe(401);
  });

  it("ないマッチなら 404 を返す", async () => {
    const leader = await createMatch();
    const response = await updateChipValues(
      "no-such-match",
      { red: 1 },
      leader.token,
    );
    expect(response.status).toBe(404);
  });

  it.each([
    ["1 色もない", {}],
    ["0", { red: 0 }],
    ["1,000,000,001", { red: 1_000_000_001 }],
    ["小数", { red: 1.5 }],
    ["文字列", { red: "100" }],
    ["知らない色", { red: 100, white: 100 }],
    ["対応でない", [100]],
  ])(
    "点数が%sなら 400 を返し, 前の点数のまま残る",
    async (_label, chipValues) => {
      const leader = await createMatch({ chipValues: { red: 100 } });
      const response = await updateChipValues(
        leader.matchId,
        chipValues,
        leader.token,
      );
      expect(response.status).toBe(400);
      expect((await readMatch(leader.matchId)).chipValues).toEqual({
        red: 100,
      });
    },
  );

  it("知らない項目が入っていたら拒否する", async () => {
    const leader = await createMatch();
    const response = await send(`/api/matches/${leader.matchId}/chip-values`, {
      method: "PUT",
      body: { chipValues: { red: 1 }, initialPoints: 1 },
      token: leader.token,
    });
    expect(response.status).toBe(400);
  });
});
