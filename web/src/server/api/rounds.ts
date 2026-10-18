import { Hono } from "hono";
import { z } from "zod";
import { validatePoints } from "../../rules/points";
import { checkCanCloseRound } from "../../rules/rounds";
import { listEntries, upsertEntryIfOpen } from "../db/entries";
import { findMatch } from "../db/matches";
import { listPlayers } from "../db/players";
import { closeRoundIfComplete, findRound } from "../db/rounds";
import { findRequestingPlayer } from "./auth";
import { scoreRoundFromRecords } from "./match-view";
import { parseJsonBody } from "./request";

const entryBody = z.object({ points: z.number() }).strict();

// 本文に何も持たない操作も, 他のサイトから送られにくいよう空の JSON を送らせる.
const emptyBody = z.object({}).strict();

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

// ラウンドを確定する. リーダーだけができ, 確定は取り消せない (docs/web/app.md).
roundsApi.post("/:roundId/close", async (c) => {
  const roundId = c.req.param("roundId");
  const body = await parseJsonBody(c.req.raw, emptyBody);
  if (!body.ok) {
    return c.json({ error: body.error }, 400);
  }
  const round = await findRound(c.env.DB, roundId);
  const match =
    round === null ? null : await findMatch(c.env.DB, round.matchId);
  if (round === null || match === null) {
    return c.json({ error: "ラウンドが見つかりません" }, 404);
  }
  const requester = await findRequestingPlayer(c.env.DB, c.req.raw, match.id);
  if (requester === null) {
    return c.json({ error: "このマッチのプレイヤーだと確かめられません" }, 401);
  }
  if (requester.id !== match.leaderPlayerId) {
    return c.json({ error: "ラウンドを確定できるのはリーダーだけです" }, 403);
  }
  const [players, entries] = await Promise.all([
    listPlayers(c.env.DB, match.id),
    listEntries(c.env.DB, match.id),
  ]);
  const score = scoreRoundFromRecords(match, players, entries, roundId);
  const canClose = checkCanCloseRound({
    isOpen: round.status === "open",
    isComplete: score.isComplete,
  });
  if (!canClose.ok) {
    return c.json({ error: canClose.reason }, 409);
  }
  if (!(await closeRoundIfComplete(c.env.DB, roundId))) {
    return c.json(
      { error: "同時に操作した人がいました. 画面を読み直してください" },
      409,
    );
  }
  return c.json({ status: "closed" });
});
