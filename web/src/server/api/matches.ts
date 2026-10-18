import { Hono } from "hono";
import { z } from "zod";
import { MAX_PLAYERS } from "../../rules/limits";
import { normalizeMatchName, normalizePlayerName } from "../../rules/names";
import { checkCanJoin } from "../../rules/players";
import { validateInitialPoints } from "../../rules/points";
import { checkCanStartRound } from "../../rules/rounds";
import { listEntries } from "../db/entries";
import { findMatch, insertMatchWithLeader } from "../db/matches";
import {
  insertPlayerIfAllowed,
  listPlayers,
  renamePlayer,
} from "../db/players";
import { insertOpenRound, listRounds } from "../db/rounds";
import { createRandomId, hashToken } from "../secrets";
import { findRequestingPlayer } from "./auth";
import { buildMatchView } from "./match-view";
import { parseJsonBody } from "./request";

const createMatchBody = z
  .object({
    matchName: z.string(),
    initialPoints: z.number(),
    leaderName: z.string(),
  })
  .strict();

const playerNameBody = z.object({ name: z.string() }).strict();

// リーダーが始める前に確かめた人数. 今の人数と違えば始めない.
const startRoundBody = z
  .object({ playerCount: z.number().int().nonnegative() })
  .strict();

/** /api/matches の下の API. */
export const matchesApi = new Hono<{ Bindings: Cloudflare.Env }>();

// マッチを作る. 作った人がリーダーのプレイヤーになり, トークンを受け取る.
matchesApi.post("/", async (c) => {
  const body = await parseJsonBody(c.req.raw, createMatchBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const matchName = normalizeMatchName(body.value.matchName);
  if (!matchName.ok) {
    return c.json({ error: matchName.reason }, 400);
  }
  const initialPoints = validateInitialPoints(body.value.initialPoints);
  if (!initialPoints.ok) {
    return c.json({ error: initialPoints.reason }, 400);
  }
  const leaderName = normalizePlayerName(body.value.leaderName);
  if (!leaderName.ok) {
    return c.json({ error: leaderName.reason }, 400);
  }

  const matchId = createRandomId();
  const playerId = createRandomId();
  const token = createRandomId();
  await insertMatchWithLeader(c.env.DB, {
    matchId,
    matchName: matchName.value,
    initialPoints: initialPoints.value,
    leaderPlayerId: playerId,
    leaderName: leaderName.value,
    leaderTokenHash: await hashToken(token),
  });
  return c.json({ matchId, playerId, token }, 201);
});

// 結果を見る. URL を知っていれば誰でも見られる (docs/web/app.md).
matchesApi.get("/:matchId", async (c) => {
  const matchId = c.req.param("matchId");
  const match = await findMatch(c.env.DB, matchId);
  if (match === null) {
    return c.json({ error: "マッチが見つかりません" }, 404);
  }
  const [players, rounds, entries] = await Promise.all([
    listPlayers(c.env.DB, matchId),
    listRounds(c.env.DB, matchId),
    listEntries(c.env.DB, matchId),
  ]);
  return c.json(buildMatchView({ match, players, rounds, entries }));
});

// 参加する. URL を知っていれば誰でも参加でき, トークンを受け取る.
matchesApi.post("/:matchId/players", async (c) => {
  const matchId = c.req.param("matchId");
  const body = await parseJsonBody(c.req.raw, playerNameBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const name = normalizePlayerName(body.value.name);
  if (!name.ok) {
    return c.json({ error: name.reason }, 400);
  }
  if ((await findMatch(c.env.DB, matchId)) === null) {
    return c.json({ error: "マッチが見つかりません" }, 404);
  }
  const players = await listPlayers(c.env.DB, matchId);
  const rounds = await listRounds(c.env.DB, matchId);
  const canJoin = checkCanJoin({
    playerCount: players.length,
    hasRoundStarted: rounds.length > 0,
  });
  if (!canJoin.ok) {
    return c.json({ error: canJoin.reason }, 409);
  }

  const playerId = createRandomId();
  const token = createRandomId();
  const outcome = await insertPlayerIfAllowed(
    c.env.DB,
    { playerId, matchId, name: name.value, tokenHash: await hashToken(token) },
    MAX_PLAYERS,
  );
  if (outcome === "name-taken") {
    return c.json({ error: "その名前はもう使われています" }, 409);
  }
  if (outcome === "not-allowed" || outcome === "busy") {
    // 判定のあとに, 他の人の参加やラウンドの開始が割り込んだとき.
    return c.json(
      { error: "同時に操作した人がいました. 画面を読み直してください" },
      409,
    );
  }
  return c.json({ playerId, token }, 201);
});

// ラウンドを始める. リーダーだけができる.
matchesApi.post("/:matchId/rounds", async (c) => {
  const matchId = c.req.param("matchId");
  const body = await parseJsonBody(c.req.raw, startRoundBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const match = await findMatch(c.env.DB, matchId);
  if (match === null) {
    return c.json({ error: "マッチが見つかりません" }, 404);
  }
  const requester = await findRequestingPlayer(c.env.DB, c.req.raw, matchId);
  if (requester === null) {
    return c.json({ error: "このマッチのプレイヤーだと確かめられません" }, 401);
  }
  if (requester.id !== match.leaderPlayerId) {
    return c.json({ error: "ラウンドを始められるのはリーダーだけです" }, 403);
  }
  const players = await listPlayers(c.env.DB, matchId);
  const rounds = await listRounds(c.env.DB, matchId);
  const canStart = checkCanStartRound({
    playerCount: players.length,
    hasOpenRound: rounds.some((round) => round.status === "open"),
    confirmedPlayerCount: body.value.playerCount,
  });
  if (!canStart.ok) {
    return c.json({ error: canStart.reason }, 409);
  }

  const roundId = createRandomId();
  const outcome = await insertOpenRound(c.env.DB, matchId, roundId);
  if (!outcome.inserted) {
    return c.json(
      { error: "同時に操作した人がいました. 画面を読み直してください" },
      409,
    );
  }
  return c.json({ roundId, number: outcome.number }, 201);
});

// 名前を変える. 本人だけが, いつでも変えられる. 計算は id で行うので, 結果には影響しない.
matchesApi.patch("/:matchId/players/:playerId", async (c) => {
  const { matchId, playerId } = c.req.param();
  const body = await parseJsonBody(c.req.raw, playerNameBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const name = normalizePlayerName(body.value.name);
  if (!name.ok) {
    return c.json({ error: name.reason }, 400);
  }
  if ((await findMatch(c.env.DB, matchId)) === null) {
    return c.json({ error: "マッチが見つかりません" }, 404);
  }
  const requester = await findRequestingPlayer(c.env.DB, c.req.raw, matchId);
  if (requester === null) {
    return c.json({ error: "このマッチのプレイヤーだと確かめられません" }, 401);
  }
  if (requester.id !== playerId) {
    return c.json({ error: "名前を変えられるのは本人だけです" }, 403);
  }
  const outcome = await renamePlayer(c.env.DB, playerId, name.value);
  if (outcome === "name-taken") {
    return c.json({ error: "その名前はもう使われています" }, 409);
  }
  return c.json({ name: name.value });
});
