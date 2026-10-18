import { exports } from "cloudflare:workers";
import { expect, it } from "vitest";

it("知らない API には 404 を返す", async () => {
  const response = await exports.default.fetch("http://localhost/api/unknown");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "見つかりません" });
});
