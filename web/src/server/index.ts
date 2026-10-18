import { Hono } from "hono";

const app = new Hono<{ Bindings: Cloudflare.Env }>();

// 知らない API には, 内部の情報を含まない短いエラーだけを返す.
app.notFound((c) => c.json({ error: "見つかりません" }, 404));

export default app;
