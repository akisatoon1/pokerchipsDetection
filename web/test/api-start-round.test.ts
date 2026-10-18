import { describe, expect, it } from "vitest";
import { createMatch, joinMatch, send, startRound } from "./helpers";

async function matchWithTwoPlayers() {
  const leader = await createMatch({ leaderName: "A" });
  const member = await joinMatch(leader.matchId, "B");
  return { leader, member };
}

async function roundsOf(matchId: string) {
  const response = await send(`/api/matches/${matchId}`);
  const match = await response.json<{
    rounds: { number: number; status: string }[];
    isJoinOpen: boolean;
    canStartRound: boolean;
  }>();
  return match;
}

describe("ラウンドを始める", () => {
  it("リーダーのトークンなら始められ, 入力中のラウンドができる", async () => {
    const { leader } = await matchWithTwoPlayers();
    const response = await startRound(leader.matchId, leader.token);
    expect(response.status).toBe(201);
    const match = await roundsOf(leader.matchId);
    expect(match.rounds).toEqual([
      expect.objectContaining({ number: 1, status: "open" }),
    ]);
  });

  it("リーダー以外のトークンでは拒否する", async () => {
    const { leader, member } = await matchWithTwoPlayers();
    const response = await startRound(leader.matchId, member.token);
    expect(response.status).toBe(403);
    expect((await roundsOf(leader.matchId)).rounds).toEqual([]);
  });

  it("別のマッチのトークンでは拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    const other = await createMatch();
    const response = await startRound(leader.matchId, other.token);
    expect(response.status).toBe(401);
  });

  it("トークンがなければ拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    expect((await startRound(leader.matchId)).status).toBe(401);
  });

  it("形の違うトークンでは拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    expect((await startRound(leader.matchId, "x")).status).toBe(401);
  });

  it("プレイヤーが 1 人なら拒否し, 2 人なら始められる", async () => {
    const leader = await createMatch();
    expect((await startRound(leader.matchId, leader.token)).status).toBe(409);
    await joinMatch(leader.matchId, "B");
    expect((await startRound(leader.matchId, leader.token)).status).toBe(201);
  });

  it("入力中のラウンドがあるときは拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    expect((await roundsOf(leader.matchId)).canStartRound).toBe(true);
    expect((await startRound(leader.matchId, leader.token)).status).toBe(201);
    expect((await roundsOf(leader.matchId)).canStartRound).toBe(false);
    expect((await startRound(leader.matchId, leader.token)).status).toBe(409);
    expect((await roundsOf(leader.matchId)).rounds).toHaveLength(1);
  });

  it("同時に始めても入力中のラウンドは 1 つだけになる", async () => {
    const { leader } = await matchWithTwoPlayers();
    const responses = await Promise.all([
      startRound(leader.matchId, leader.token),
      startRound(leader.matchId, leader.token),
      startRound(leader.matchId, leader.token),
    ]);
    const created = responses.filter((response) => response.status === 201);
    expect(created).toHaveLength(1);
    expect((await roundsOf(leader.matchId)).rounds).toHaveLength(1);
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    const response = await send(`/api/matches/${leader.matchId}/rounds`, {
      method: "POST",
      body: { playerCount: 2, number: 5 },
      token: leader.token,
    });
    expect(response.status).toBe(400);
  });

  it("存在しないマッチなら 404 を返す", async () => {
    const leader = await createMatch();
    expect((await startRound("no-such-match", leader.token)).status).toBe(404);
  });
});

describe("確かめた人数", () => {
  it("今の人数と同じ人数を送れば始められる", async () => {
    const { leader } = await matchWithTwoPlayers();
    expect((await startRound(leader.matchId, leader.token, 2)).status).toBe(
      201,
    );
  });

  it("確かめたあとに 1 人参加して人数が変わったら拒否し, ラウンドはできない", async () => {
    const { leader } = await matchWithTwoPlayers();
    // リーダーが 2 人を確かめている間に C が参加した.
    await joinMatch(leader.matchId, "C");
    const response = await startRound(leader.matchId, leader.token, 2);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "参加者が変わりました. 確かめ直してください",
    });
    expect((await roundsOf(leader.matchId)).rounds).toEqual([]);
  });

  it.each([
    ["ない", {}],
    ["文字列", { playerCount: "2" }],
    ["負の数", { playerCount: -1 }],
    ["小数", { playerCount: 2.5 }],
  ])("playerCount が%sなら拒否する", async (_label, body) => {
    const { leader } = await matchWithTwoPlayers();
    const response = await send(`/api/matches/${leader.matchId}/rounds`, {
      method: "POST",
      body,
      token: leader.token,
    });
    expect(response.status).toBe(400);
  });
});

describe("ラウンドを始めたあとの参加", () => {
  it("最初のラウンドを始めたあとは参加を拒否する", async () => {
    const { leader } = await matchWithTwoPlayers();
    expect((await roundsOf(leader.matchId)).isJoinOpen).toBe(true);
    await startRound(leader.matchId, leader.token);
    const response = await send(`/api/matches/${leader.matchId}/players`, {
      method: "POST",
      body: { name: "C" },
    });
    expect(response.status).toBe(409);
    expect((await roundsOf(leader.matchId)).isJoinOpen).toBe(false);
  });
});
