import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { hashToken } from "../src/server/secrets";
import { createMatch, send } from "./helpers";

const validBody = {
  matchName: "金曜の会",
  initialPoints: 100,
  leaderName: "リーダー",
};

function postMatch(body: unknown) {
  return send("/api/matches", { method: "POST", body });
}

describe("マッチを作る", () => {
  it("作った人がリーダーのプレイヤーになり, トークンが返る", async () => {
    const created = await createMatch();
    const response = await send(`/api/matches/${created.matchId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: created.matchId,
      name: "金曜の会",
      initialPoints: 100,
      leaderPlayerId: created.playerId,
      isJoinOpen: true,
      canStartRound: false,
      players: [{ id: created.playerId, name: "リーダー" }],
      rounds: [],
    });
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("DB にはトークンそのものではなくハッシュが入っている", async () => {
    const created = await createMatch();
    const row = await env.DB.prepare(
      "SELECT token_hash FROM players WHERE id = ?",
    )
      .bind(created.playerId)
      .first<{ token_hash: string }>();
    expect(row?.token_hash).toBe(await hashToken(created.token));
    expect(row?.token_hash).not.toContain(created.token);
  });

  it("マッチの id は作るたびに違い, 128 ビットの乱数の長さがある", async () => {
    const first = await createMatch();
    const second = await createMatch();
    expect(first.matchId).not.toBe(second.matchId);
    // 128 ビットを base64url にすると 22 文字になる.
    expect(first.matchId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(second.matchId).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("名前とマッチ名の前後の空白を除いて保存する", async () => {
    const created = await createMatch({
      matchName: "  金曜の会 ",
      leaderName: " 太郎  ",
    });
    const response = await send(`/api/matches/${created.matchId}`);
    const match = await response.json<{
      name: string;
      players: { name: string }[];
    }>();
    expect(match.name).toBe("金曜の会");
    expect(match.players[0]?.name).toBe("太郎");
  });

  it.each([
    ["空", ""],
    ["空白だけ", "   "],
    ["21 文字", "あ".repeat(21)],
  ])("名前が%sなら拒否する", async (_label, leaderName) => {
    const response = await postMatch({ ...validBody, leaderName });
    expect(response.status).toBe(400);
  });

  it("名前が 1 文字と 20 文字なら受け付ける", async () => {
    expect((await postMatch({ ...validBody, leaderName: "a" })).status).toBe(
      201,
    );
    expect(
      (await postMatch({ ...validBody, leaderName: "あ".repeat(20) })).status,
    ).toBe(201);
  });

  it("マッチ名が空か 41 文字なら拒否し, 40 文字なら受け付ける", async () => {
    expect((await postMatch({ ...validBody, matchName: "" })).status).toBe(400);
    expect(
      (await postMatch({ ...validBody, matchName: "x".repeat(41) })).status,
    ).toBe(400);
    expect(
      (await postMatch({ ...validBody, matchName: "x".repeat(40) })).status,
    ).toBe(201);
  });

  it.each([
    ["0", 0],
    ["負の数", -1],
    ["小数", 1.5],
    ["文字列", "100"],
    ["1,000,000,001", 1_000_000_001],
  ])("初期点数が%sなら拒否する", async (_label, initialPoints) => {
    const response = await postMatch({ ...validBody, initialPoints });
    expect(response.status).toBe(400);
  });

  it("初期点数が 1 と 1,000,000,000 なら受け付ける", async () => {
    expect((await postMatch({ ...validBody, initialPoints: 1 })).status).toBe(
      201,
    );
    expect(
      (await postMatch({ ...validBody, initialPoints: 1_000_000_000 })).status,
    ).toBe(201);
  });

  it("知らない項目が入っていたら拒否する", async () => {
    const response = await postMatch({ ...validBody, isAdmin: true });
    expect(response.status).toBe(400);
  });

  it("項目が足りなければ拒否する", async () => {
    const response = await postMatch({ matchName: "金曜の会" });
    expect(response.status).toBe(400);
  });

  it("本文が 4 KB を超えたら拒否する", async () => {
    const response = await postMatch({
      ...validBody,
      matchName: "x".repeat(5000),
    });
    expect(response.status).toBe(413);
  });

  it("JSON でなければ拒否する", async () => {
    const response = await send("/api/matches", { method: "POST" });
    expect(response.status).toBe(415);
  });

  it("壊れた JSON なら拒否する", async () => {
    const response = await send("/api/matches", {
      method: "POST",
      rawBody: "{",
    });
    expect(response.status).toBe(400);
  });
});

describe("マッチを見る", () => {
  it("トークンなしでも読める", async () => {
    const created = await createMatch();
    const response = await send(`/api/matches/${created.matchId}`);
    expect(response.status).toBe(200);
  });

  it("存在しない id なら 404 を返し, 内部の情報を出さない", async () => {
    const response = await send("/api/matches/no-such-match");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "マッチが見つかりません" });
  });
});
