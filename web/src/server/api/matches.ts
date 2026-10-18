import { Hono } from "hono";
import { z } from "zod";
import { normalizeMatchName, normalizePlayerName } from "../../rules/names";
import { validateInitialPoints } from "../../rules/points";
import { findMatch, insertMatchWithLeader } from "../db/matches";
import { listPlayers } from "../db/players";
import { createRandomId, hashToken } from "../secrets";
import { parseJsonBody } from "./request";

const createMatchBody = z
  .object({
    matchName: z.string(),
    initialPoints: z.number(),
    leaderName: z.string(),
  })
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
  const players = await listPlayers(c.env.DB, matchId);
  return c.json({
    id: match.id,
    name: match.name,
    initialPoints: match.initialPoints,
    leaderPlayerId: match.leaderPlayerId,
    players,
  });
});
