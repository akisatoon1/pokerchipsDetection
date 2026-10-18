import { describe, expect, it } from "vitest";
import { createMatch, send } from "./helpers";

function join(matchId: string, name: string) {
  return send(`/api/matches/${matchId}/players`, {
    method: "POST",
    body: { name },
  });
}

async function playerNames(matchId: string): Promise<string[]> {
  const response = await send(`/api/matches/${matchId}`);
  const match = await response.json<{ players: { name: string }[] }>();
  return match.players.map((player) => player.name);
}

describe("参加する", () => {
  it("参加した人がプレイヤーになり, 参加した順に並ぶ", async () => {
    const { matchId } = await createMatch({ leaderName: "A" });
    expect((await join(matchId, "B")).status).toBe(201);
    expect((await join(matchId, "C")).status).toBe(201);
    expect(await playerNames(matchId)).toEqual(["A", "B", "C"]);
  });

  it("参加した人には, 他の人とは違うトークンが返る", async () => {
    const leader = await createMatch();
    const first = await (
      await join(leader.matchId, "B")
    ).json<{ playerId: string; token: string }>();
    const second = await (
      await join(leader.matchId, "C")
    ).json<{ playerId: string; token: string }>();
    const tokens = new Set([leader.token, first.token, second.token]);
    expect(tokens.size).toBe(3);
    expect(first.playerId).not.toBe(second.playerId);
  });

  it("同じマッチで名前が重なったら拒否する", async () => {
    const { matchId } = await createMatch({ leaderName: "太郎" });
    const response = await join(matchId, "太郎");
    expect(response.status).toBe(409);
    expect(await playerNames(matchId)).toEqual(["太郎"]);
  });

  it("前後の空白を除くと重なる名前も拒否する", async () => {
    const { matchId } = await createMatch({ leaderName: "太郎" });
    expect((await join(matchId, " 太郎 ")).status).toBe(409);
  });

  it("別のマッチなら同じ名前で参加できる", async () => {
    await createMatch({ leaderName: "太郎" });
    const other = await createMatch({ leaderName: "花子" });
    expect((await join(other.matchId, "太郎")).status).toBe(201);
  });

  it("10 人いたら 11 人目を拒否する", async () => {
    const { matchId } = await createMatch({ leaderName: "P1" });
    for (let index = 2; index <= 10; index += 1) {
      expect((await join(matchId, `P${String(index)}`)).status).toBe(201);
    }
    expect((await join(matchId, "P11")).status).toBe(409);
    expect(await playerNames(matchId)).toHaveLength(10);
  });

  it("名前が決まりを満たさなければ拒否する", async () => {
    const { matchId } = await createMatch();
    expect((await join(matchId, "")).status).toBe(400);
    expect((await join(matchId, "あ".repeat(21))).status).toBe(400);
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const { matchId } = await createMatch();
    const response = await send(`/api/matches/${matchId}/players`, {
      method: "POST",
      body: { name: "B", isLeader: true },
    });
    expect(response.status).toBe(400);
  });

  it("存在しないマッチには参加できない", async () => {
    const response = await join("no-such-match", "B");
    expect(response.status).toBe(404);
  });
});
