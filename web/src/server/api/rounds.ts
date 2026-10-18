import { Hono } from "hono";
import { z } from "zod";
import { validatePoints } from "../../rules/points";
import { upsertEntryIfOpen } from "../db/entries";
import { findRound } from "../db/rounds";
import { findRequestingPlayer } from "./auth";
import { parseJsonBody } from "./request";

const entryBody = z.object({ points: z.number() }).strict();

/** /api/rounds の下の API. */
export const roundsApi = new Hono<{ Bindings: Cloudflare.Env }>();

// 持ち点を入れる・直す. 本人だけが, 入力中のラウンドに入れられる. 何度でも上書きできる.
roundsApi.put("/:roundId/entries/:playerId", async (c) => {
  const { roundId, playerId } = c.req.param();
  const body = await parseJsonBody(c.req.raw, entryBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const points = validatePoints(body.value.points);
  if (!points.ok) {
    return c.json({ error: points.reason }, 400);
  }
  const round = await findRound(c.env.DB, roundId);
  if (round === null) {
    return c.json({ error: "ラウンドが見つかりません" }, 404);
  }
  const requester = await findRequestingPlayer(
    c.env.DB,
    c.req.raw,
    round.matchId,
  );
  if (requester === null) {
    return c.json({ error: "このマッチのプレイヤーだと確かめられません" }, 401);
  }
  if (requester.id !== playerId) {
    return c.json({ error: "持ち点を入れられるのは本人だけです" }, 403);
  }
  // 確定したラウンドは変えられない (リーダーの確定は取り消せない仕様のため).
  const isSaved = await upsertEntryIfOpen(c.env.DB, {
    roundId,
    playerId,
    points: points.value,
  });
  if (!isSaved) {
    return c.json({ error: "このラウンドは確定しています" }, 409);
  }
  return c.json({ points: points.value });
});
