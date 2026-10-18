import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { matchesApi } from "./api/matches";

/** リクエストの本文の上限 (バイト). 公開された URL に大量のデータを送られても壊れないようにするため. */
const MAX_BODY_BYTES = 4 * 1024;

/** 本文を持つメソッド. JSON だけを受け付ける. */
const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

// 本文は JSON だけを受け付ける. フォームの送信など, 他のサイトから
// 事前確認 (preflight) なしに送れる形を拒否するためでもある.
const requireJson = createMiddleware(async (c, next) => {
  const contentType = c.req.header("Content-Type") ?? "";
  if (
    METHODS_WITH_BODY.has(c.req.method) &&
    !contentType.startsWith("application/json")
  ) {
    return c.json({ error: "本文は JSON で送ってください" }, 415);
  }
  await next();
});

const app = new Hono<{ Bindings: Cloudflare.Env }>();

app.use(
  "/api/*",
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => c.json({ error: "本文が大きすぎます" }, 413),
  }),
);
app.use("/api/*", requireJson);

app.route("/api/matches", matchesApi);

// 知らない API には, 内部の情報を含まない短いエラーだけを返す.
app.notFound((c) => c.json({ error: "見つかりません" }, 404));

// 思わぬ失敗の中身 (SQL など) は利用者に返さず, ログにだけ残す. ログにトークンは入らない.
app.onError((error, c) => {
  console.error(error.name, error.message);
  return c.json({ error: "サーバーで問題が起きました" }, 500);
});

export default app;
