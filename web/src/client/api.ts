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
  isJoinOpen: z.boolean(),
  canStartRound: z.boolean(),
  players: z.array(z.object({ id: z.string(), name: z.string() })),
  rounds: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      status: z.enum(["open", "closed"]),
      scores: z.array(
        z.object({
          playerId: z.string(),
          points: z.number().nullable(),
          delta: z.number().nullable(),
        }),
      ),
      isComplete: z.boolean(),
      totalPoints: z.number(),
      expectedTotalPoints: z.number(),
      hasTotalMismatch: z.boolean(),
    }),
  ),
});

const savedEntry = z.object({ points: z.number() });

const joinedPlayer = z.object({ playerId: z.string(), token: z.string() });

const startedRound = z.object({ roundId: z.string(), number: z.number() });

/** 作ったマッチと, リーダーのトークン. */
export type CreatedMatch = z.infer<typeof createdMatch>;

/** 参加したプレイヤーの id とトークン. */
export type JoinedPlayer = z.infer<typeof joinedPlayer>;

/** マッチの画面に出すもの. */
export type MatchView = z.infer<typeof matchView>;

/** マッチの 1 つのラウンド. */
export type RoundView = MatchView["rounds"][number];

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

/**
 * マッチに参加する.
 *
 * @param matchId マッチの id.
 * @param name 参加する人の名前.
 * @returns プレイヤーの id とトークン. 名前が重なる, 満員などで失敗なら説明.
 */
export function joinMatch(
  matchId: string,
  name: string,
): Promise<ApiResult<JoinedPlayer>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/players`,
    joinedPlayer,
    { method: "POST", body: { name } },
  );
}

/**
 * ラウンドを始める. リーダーだけができる.
 *
 * @param matchId マッチの id.
 * @param token リーダーのトークン.
 * @returns 新しいラウンドの id と番号. リーダーでない, 入力中のラウンドがあるなどで失敗なら説明.
 */
export function startRound(
  matchId: string,
  token: string,
): Promise<ApiResult<{ roundId: string; number: number }>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/rounds`,
    startedRound,
    { method: "POST", body: {}, token },
  );
}

/**
 * 自分の持ち点を入れる・直す.
 *
 * @param roundId ラウンドの id.
 * @param playerId 自分のプレイヤーの id.
 * @param points 持ち点.
 * @param token 自分のトークン.
 * @returns 保存した持ち点. 範囲外, 確定済みなどで失敗なら説明.
 */
export function putEntry(
  roundId: string,
  playerId: string,
  points: number,
  token: string,
): Promise<ApiResult<{ points: number }>> {
  return request(
    `/api/rounds/${encodeURIComponent(roundId)}/entries/${encodeURIComponent(playerId)}`,
    savedEntry,
    { method: "PUT", body: { points }, token },
  );
}
