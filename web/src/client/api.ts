import { z } from "zod";
import { CHIP_COLOR_NAMES, type ChipValuesRecord } from "../rules/chip-values";
import { MAX_POINTS } from "../rules/limits";

// API を呼ぶ処理. 応答は zod で形を確かめてから使う.

/**
 * API の結果. 失敗なら利用者に見せる説明と, HTTP のステータスを持つ.
 *
 * ステータスは, 見つからない (404) ときに一覧から消すなど, 失敗の種類で扱いを変えるために使う.
 * サーバーにつながらなかったときは null.
 */
export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; error: string; status: number | null };

const errorResponse = z.object({ error: z.string() });

const createdMatch = z.object({
  matchId: z.string(),
  playerId: z.string(),
  token: z.string(),
});

// 色ごとの点数. 決めていない (この仕様より前に作った) マッチなら空.
const chipValues = z.partialRecord(
  z.enum(CHIP_COLOR_NAMES),
  z.number().int().min(1).max(MAX_POINTS),
);

const matchView = z.object({
  id: z.string(),
  name: z.string(),
  initialPoints: z.number(),
  leaderPlayerId: z.string(),
  chipValues,
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
  totals: z.array(z.object({ playerId: z.string(), total: z.number() })),
});

const closedRound = z.object({ status: z.literal("closed") });

const renamedPlayer = z.object({ name: z.string() });

const updatedChipValues = z.object({ chipValues });

const savedEntry = z.object({ points: z.number() });

const joinedPlayer = z.object({ playerId: z.string(), token: z.string() });

const startedRound = z.object({ roundId: z.string(), number: z.number() });

// 本文のない応答 (204). 本文を JSON として読めないので null になる.
const noContent = z.null();

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
  chipValues: ChipValuesRecord;
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
    return { ok: false, error: "サーバーにつながりません", status: null };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsedError = errorResponse.safeParse(body);
    return {
      ok: false,
      error: parsedError.success
        ? parsedError.data.error
        : "うまくいきませんでした",
      status: response.status,
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: "サーバーの応答が読めません",
      status: response.status,
    };
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
 * @param playerCount リーダーが始める前に確かめた人数. 今の人数と違えばサーバーが拒否する.
 * @returns 新しいラウンドの id と番号. リーダーでない, 入力中のラウンドがある,
 *   参加者が変わったなどで失敗なら説明.
 */
export function startRound(
  matchId: string,
  token: string,
  playerCount: number,
): Promise<ApiResult<{ roundId: string; number: number }>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/rounds`,
    startedRound,
    { method: "POST", body: { playerCount }, token },
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

/**
 * ラウンドを確定する. リーダーだけができ, 取り消せない.
 *
 * @param roundId ラウンドの id.
 * @param token リーダーのトークン.
 * @returns 確定した状態. 未入力の人がいる, リーダーでないなどで失敗なら説明.
 */
export function closeRound(
  roundId: string,
  token: string,
): Promise<ApiResult<{ status: "closed" }>> {
  return request(
    `/api/rounds/${encodeURIComponent(roundId)}/close`,
    closedRound,
    { method: "POST", body: {}, token },
  );
}

/**
 * マッチの色ごとの点数を変える. リーダーだけができる.
 *
 * @param matchId マッチの id.
 * @param values 新しい色ごとの点数.
 * @param token リーダーのトークン.
 * @returns 保存した色ごとの点数. 決まりを満たさない, リーダーでないなどで失敗なら説明.
 */
export function updateChipValues(
  matchId: string,
  values: ChipValuesRecord,
  token: string,
): Promise<ApiResult<{ chipValues: ChipValuesRecord }>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/chip-values`,
    updatedChipValues,
    { method: "PUT", body: { chipValues: values }, token },
  );
}

/**
 * 自分の名前を変える.
 *
 * @param matchId マッチの id.
 * @param playerId 自分のプレイヤーの id.
 * @param name 新しい名前.
 * @param token 自分のトークン.
 * @returns 保存した名前. 決まりを満たさない, 他の人と重なるなどで失敗なら説明.
 */
export function renamePlayer(
  matchId: string,
  playerId: string,
  name: string,
  token: string,
): Promise<ApiResult<{ name: string }>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/players/${encodeURIComponent(playerId)}`,
    renamedPlayer,
    { method: "PATCH", body: { name }, token },
  );
}

/**
 * マッチを削除する. リーダーだけができ, 元に戻せない.
 *
 * @param matchId マッチの id.
 * @param token リーダーのトークン.
 * @returns 消せたら null. リーダーでない, 見つからないなどで失敗なら説明.
 */
export function deleteMatch(
  matchId: string,
  token: string,
): Promise<ApiResult<null>> {
  return request(`/api/matches/${encodeURIComponent(matchId)}`, noContent, {
    method: "DELETE",
    token,
  });
}

/**
 * プレイヤーを削除する. リーダーだけが, 最初のラウンドの前に, リーダー以外を削除できる.
 *
 * @param matchId マッチの id.
 * @param playerId 削除するプレイヤーの id.
 * @param token リーダーのトークン.
 * @returns 消せたら null. リーダーでない, ラウンドが始まった, 見つからないなどで失敗なら説明.
 */
export function deletePlayer(
  matchId: string,
  playerId: string,
  token: string,
): Promise<ApiResult<null>> {
  return request(
    `/api/matches/${encodeURIComponent(matchId)}/players/${encodeURIComponent(playerId)}`,
    noContent,
    { method: "DELETE", token },
  );
}
