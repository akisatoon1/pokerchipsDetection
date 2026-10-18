// 点数の計算 (docs/web/scoring.md). 増減と累計は保存せず, 読むたびにここで計算する.

/** 1 つのラウンドを計算するための入力. */
export interface RoundInput {
  initialPoints: number;
  // マッチのプレイヤーの id. この順に結果を並べる. 人数 n はこの長さ.
  playerIds: string[];
  // 入力された持ち点. 入れていない人は含まない.
  pointsByPlayer: ReadonlyMap<string, number>;
}

/** 1 人の 1 ラウンドの結果. */
export interface PlayerRoundScore {
  playerId: string;
  // 持ち点. 未入力なら null.
  points: number | null;
  // 増減 d = p − S. 未入力なら null.
  delta: number | null;
}

/** 1 つのラウンドの結果. */
export interface RoundScore {
  scores: PlayerRoundScore[];
  // 全員の持ち点がそろっているか. 確定できるのはそろったときだけ.
  isComplete: boolean;
  // 入力された持ち点の合計.
  totalPoints: number;
  // 入力に間違いがなければ成り立つ持ち点の合計 S × n.
  expectedTotalPoints: number;
  // 全員がそろったのに合計が S × n と合わないなら true. そろっていないうちは検査しないので false.
  hasTotalMismatch: boolean;
}

/**
 * 1 つのラウンドの増減と, 合計の検査を計算する.
 *
 * 増減は入力中のラウンドでも計算する. 確定する前に全員が結果を見て, 間違いに気づけるようにするため.
 * @param input 初期点数, プレイヤー, 入力された持ち点.
 * @returns プレイヤーごとの持ち点と増減, そろっているか, 合計が合っているか.
 */
export function scoreRound(input: RoundInput): RoundScore {
  const scores = input.playerIds.map((playerId) => {
    const points = input.pointsByPlayer.get(playerId) ?? null;
    return {
      playerId,
      points,
      delta: points === null ? null : points - input.initialPoints,
    };
  });
  const isComplete = scores.every((score) => score.points !== null);
  const totalPoints = scores.reduce(
    (sum, score) => sum + (score.points ?? 0),
    0,
  );
  const expectedTotalPoints = input.initialPoints * input.playerIds.length;
  return {
    scores,
    isComplete,
    totalPoints,
    expectedTotalPoints,
    hasTotalMismatch: isComplete && totalPoints !== expectedTotalPoints,
  };
}

/** 累計を計算するための, 1 つのラウンド. */
export interface RoundForTotals {
  isClosed: boolean;
  scores: readonly PlayerRoundScore[];
}

/** 1 人の累計. */
export interface PlayerTotal {
  playerId: string;
  total: number;
}

/**
 * プレイヤーごとの累計を計算する.
 *
 * 累計は確定したラウンドの増減の和. 入力中のラウンドは含めない (docs/web/scoring.md).
 * @param playerIds マッチのプレイヤーの id. この順に結果を並べる.
 * @param rounds マッチのラウンド.
 * @returns プレイヤーごとの累計. 確定したラウンドがなければ全員 0.
 */
export function computeTotals(
  playerIds: readonly string[],
  rounds: readonly RoundForTotals[],
): PlayerTotal[] {
  const totals = new Map(playerIds.map((playerId) => [playerId, 0]));
  for (const round of rounds) {
    if (!round.isClosed) {
      continue;
    }
    for (const score of round.scores) {
      const current = totals.get(score.playerId);
      if (current !== undefined && score.delta !== null) {
        totals.set(score.playerId, current + score.delta);
      }
    }
  }
  return playerIds.map((playerId) => ({
    playerId,
    total: totals.get(playerId) ?? 0,
  }));
}
