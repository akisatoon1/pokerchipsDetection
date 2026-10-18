import { z } from "zod";

// API を呼ぶ処理. 応答は zod で形を確かめてから使う.

/** API の結果. 失敗なら利用者に見せる説明を持つ. */
export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; error: string };

const errorResponse = z.object({ error: z.string() });

const createdMatch = z.object({
  matchId: z.string(),
  playerId: z.string(),
  token: z.string(),
});

const matchView = z.object({
  id: z.string(),
  name: z.string(),
  initialPoints: z.number(),
  leaderPlayerId: z.string(),
  players: z.array(z.object({ id: z.string(), name: z.string() })),
});

/** 作ったマッチと, リーダーのトークン. */
export type CreatedMatch = z.infer<typeof createdMatch>;

/** マッチの画面に出すもの. */
export type MatchView = z.infer<typeof matchView>;

/** 新しいマッチの入力. */
export interface NewMatchInput {
  matchName: string;
  initialPoints: number;
  leaderName: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch {
    return { ok: false, error: "サーバーにつながりません" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = errorResponse.safeParse(body);
    return {
      ok: false,
      error: parsedError.success
        ? parsedError.data.error
        : "うまくいきませんでした",
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "サーバーの応答が読めません" };
  }
  return { ok: true, value: parsed.data };
}

/**
 * マッチを作る.
 *
 * @param input マッチ名, 初期点数, リーダーの名前.
 * @returns マッチの id と, リーダーのプレイヤーの id とトークン. 失敗なら説明.
 */
export function createMatch(
  input: NewMatchInput,
): Promise<ApiResult<CreatedMatch>> {
  return request("/api/matches", createdMatch, { method: "POST", body: input });
}

/**
 * マッチを読む.
 *
 * @param matchId マッチの id.
 * @returns マッチとプレイヤー. 見つからなければ説明.
 */
export function getMatch(matchId: string): Promise<ApiResult<MatchView>> {
  return request(`/api/matches/${encodeURIComponent(matchId)}`, matchView);
}
