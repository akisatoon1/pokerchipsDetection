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

export function putEntry(
  roundId: string,
  playerId: string,
  points: unknown,
  token?: string,
) {
  return send(`/api/rounds/${roundId}/entries/${playerId}`, {
    method: "PUT",
    body: { points },
    ...(token === undefined ? {} : { token }),
  });
}

export interface PlayerScoreView {
  playerId: string;
  points: number | null;
  delta: number | null;
}

export interface RoundView {
  id: string;
  number: number;
  status: "open" | "closed";
  scores: PlayerScoreView[];
  isComplete: boolean;
  totalPoints: number;
  expectedTotalPoints: number;
  hasTotalMismatch: boolean;
}

export interface MatchView {
  id: string;
  isJoinOpen: boolean;
  canStartRound: boolean;
  players: { id: string; name: string }[];
  rounds: RoundView[];
}

export async function readMatch(matchId: string): Promise<MatchView> {
  const response = await send(`/api/matches/${matchId}`);
  return response.json();
}

// リーダー A と, 参加した B, C のマッチを作り, 最初のラウンドを始める.
export async function matchWithOpenRound(initialPoints = 100) {
  const leader = await createMatch({ leaderName: "A", initialPoints });
  const playerB = await joinMatch(leader.matchId, "B");
  const playerC = await joinMatch(leader.matchId, "C");
  const started = await startRound(leader.matchId, leader.token);
  const { roundId } = await started.json<{ roundId: string }>();
  return { leader, playerB, playerC, roundId };
}
