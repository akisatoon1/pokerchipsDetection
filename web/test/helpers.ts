import { exports } from "cloudflare:workers";

// テストから Worker を呼ぶための小さな道具.

export interface SendOptions {
  method?: string;
  body?: unknown;
  // JSON にせずにそのまま送る本文. 壊れた JSON を送るときに使う.
  rawBody?: string;
  token?: string;
}

export function send(path: string, options: SendOptions = {}) {
  const headers: Record<string, string> = {};
  let body: string | null = null;
  if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  } else if (options.rawBody !== undefined) {
    body = options.rawBody;
  }
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token !== undefined) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  return exports.default.fetch(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });
}

export interface CreatedMatch {
  matchId: string;
  playerId: string;
  token: string;
}

export async function createMatch(
  overrides: Record<string, unknown> = {},
): Promise<CreatedMatch> {
  const response = await send("/api/matches", {
    method: "POST",
    body: {
      matchName: "金曜の会",
      initialPoints: 100,
      leaderName: "リーダー",
      ...overrides,
    },
  });
  if (response.status !== 201) {
    throw new Error(`マッチを作れなかった: ${String(response.status)}`);
  }
  return response.json();
}

export interface JoinedPlayer {
  playerId: string;
  token: string;
}

export async function joinMatch(
  matchId: string,
  name: string,
): Promise<JoinedPlayer> {
  const response = await send(`/api/matches/${matchId}/players`, {
    method: "POST",
    body: { name },
  });
  if (response.status !== 201) {
    throw new Error(`参加できなかった: ${String(response.status)}`);
  }
  return response.json();
}

export function startRound(matchId: string, token?: string) {
  return send(`/api/matches/${matchId}/rounds`, {
    method: "POST",
    body: {},
    ...(token === undefined ? {} : { token }),
  });
}
