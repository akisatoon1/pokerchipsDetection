import type { z } from "zod";

/** 本文を読んだ結果. 失敗なら利用者に返す短い説明を持つ. */
export type ParsedBody<T> =
  { ok: true; value: T } | { ok: false; error: string };

/**
 * リクエストの本文を JSON として読み, スキーマで形を確かめる.
 *
 * 外から来る入力は API の入口で確かめ, 内側には検証済みの値だけを渡すため (docs/web/code-rules.md).
 * @param request 届いたリクエスト.
 * @param schema 本文の形. 知らない項目を拒否するよう strict にしておく.
 * @returns 形を満たした値. JSON でないときや形が違うときは ok: false と説明.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParsedBody<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "本文が JSON ではありません" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "入力の形が正しくありません" };
  }
  return { ok: true, value: parsed.data };
}
