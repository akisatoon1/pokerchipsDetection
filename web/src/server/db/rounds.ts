import { isUniqueViolation } from "./players";

/** ラウンドの状態. 入力中か確定. */
export type RoundStatus = "open" | "closed";

/** DB に保存したラウンド. */
export interface RoundRecord {
  id: string;
  number: number;
  status: RoundStatus;
}

/** ラウンドと, それが属するマッチ. */
export interface RoundWithMatch extends RoundRecord {
  matchId: string;
}

/**
 * ラウンドを id で探す.
 *
 * @param db D1 のデータベース.
 * @param roundId ラウンドの id.
 * @returns 見つかったラウンド. なければ null.
 */
export async function findRound(
  db: D1Database,
  roundId: string,
): Promise<RoundWithMatch | null> {
  return db
    .prepare(
      "SELECT id, match_id AS matchId, number, status FROM rounds WHERE id = ?",
    )
    .bind(roundId)
    .first<RoundWithMatch>();
}

/**
 * マッチのラウンドを番号の順に返す.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @returns ラウンドの一覧. なければ空.
 */
export async function listRounds(
  db: D1Database,
  matchId: string,
): Promise<RoundRecord[]> {
  const { results } = await db
    .prepare(
      "SELECT id, number, status FROM rounds WHERE match_id = ? ORDER BY number",
    )
    .bind(matchId)
    .all<RoundRecord>();
  return results;
}

/** ラウンドを保存した結果. */
export type InsertRoundOutcome =
  { inserted: true; number: number } | { inserted: false };

/**
 * 入力中のラウンドを, 次の番号で保存する.
 *
 * 入力中のラウンドが既にあれば, 部分 UNIQUE インデックスに反して保存されない.
 * 始められるかの判定は rules/rounds.ts で済ませておく. ここは同時に送られたときの最後の守り.
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @param roundId 新しいラウンドの id.
 * @returns 保存できたらその番号. 入力中のラウンドがあった, 番号がぶつかったなら inserted: false.
 * @throws DB に届かないときや, 思わぬ制約に反したとき.
 */
export async function insertOpenRound(
  db: D1Database,
  matchId: string,
  roundId: string,
): Promise<InsertRoundOutcome> {
  try {
    const row = await db
      .prepare(
        `INSERT INTO rounds (id, match_id, number, status)
         SELECT ?, ?, COALESCE(MAX(number), 0) + 1, 'open' FROM rounds WHERE match_id = ?
         RETURNING number`,
      )
      .bind(roundId, matchId, matchId)
      .first<{ number: number }>();
    if (row === null) {
      return { inserted: false };
    }
    return { inserted: true, number: row.number };
  } catch (error) {
    if (
      isUniqueViolation(error, "rounds.match_id, rounds.number") ||
      isUniqueViolation(error, "rounds.match_id")
    ) {
      return { inserted: false };
    }
    throw error;
  }
}

/**
 * ラウンドを, 入力中で全員の持ち点がそろっているときだけ確定する.
 *
 * 確定できるかの判定は rules/rounds.ts で済ませておく. ここの条件は, 同時に確定や
 * 入力が送られても決まりを破らないための最後の守り.
 * @param db D1 のデータベース.
 * @param roundId ラウンドの id.
 * @returns 確定できたら true. 既に確定していた, そろっていなかったなら false.
 */
export async function closeRoundIfComplete(
  db: D1Database,
  roundId: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE rounds SET status = 'closed'
       WHERE id = ? AND status = 'open'
         AND (SELECT COUNT(*) FROM entries WHERE round_id = rounds.id)
           = (SELECT COUNT(*) FROM players WHERE match_id = rounds.match_id)`,
    )
    .bind(roundId)
    .run();
  return result.meta.changes === 1;
}
