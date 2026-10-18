import { Hono } from "hono";
import { z } from "zod";
import { normalizeMatchName, normalizePlayerName } from "../../rules/names";
import { validateInitialPoints } from "../../rules/points";
import { findMatch, insertMatchWithLeader } from "../db/matches";
import { MAX_PLAYERS } from "../../rules/limits";
import { insertPlayerIfRoom, listPlayers } from "../db/players";
import { createRandomId, hashToken } from "../secrets";
import { parseJsonBody } from "./request";

const createMatchBody = z
  .object({
    matchName: z.string(),
    initialPoints: z.number(),
    leaderName: z.string(),
  })
  .strict();

const joinMatchBody = z.object({ name: z.string() }).strict();

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
  const players = await listPlayers(c.env.DB, matchId);
  return c.json({
    id: match.id,
    name: match.name,
    initialPoints: match.initialPoints,
    leaderPlayerId: match.leaderPlayerId,
    players,
  });
});

// 参加する. URL を知っていれば誰でも参加でき, トークンを受け取る.
matchesApi.post("/:matchId/players", async (c) => {
  const matchId = c.req.param("matchId");
  const body = await parseJsonBody(c.req.raw, joinMatchBody);
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

  const playerId = createRandomId();
  const token = createRandomId();
  const outcome = await insertPlayerIfRoom(
    c.env.DB,
    { playerId, matchId, name: name.value, tokenHash: await hashToken(token) },
    MAX_PLAYERS,
  );
  if (outcome === "full") {
    return c.json(
      { error: `参加できるのは ${String(MAX_PLAYERS)} 人までです` },
      409,
    );
  }
  if (outcome === "name-taken") {
    return c.json({ error: "その名前はもう使われています" }, 409);
  }
  if (outcome === "busy") {
    return c.json(
      { error: "同時に参加した人がいました. もう一度試してください" },
      409,
    );
  }
  return c.json({ playerId, token }, 201);
});
