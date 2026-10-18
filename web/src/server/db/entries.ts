/** DB に保存した持ち点. */
export interface EntryRecord {
  roundId: string;
  playerId: string;
  points: number;
}

/**
 * マッチの全ラウンドの持ち点を返す.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @returns 持ち点の一覧. 順番は決めていない.
 */
export async function listEntries(
  db: D1Database,
  matchId: string,
): Promise<EntryRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT entries.round_id AS roundId, entries.player_id AS playerId, entries.points AS points
       FROM entries JOIN rounds ON rounds.id = entries.round_id
       WHERE rounds.match_id = ?`,
    )
    .bind(matchId)
    .all<EntryRecord>();
  return results;
}

/**
 * 持ち点を, ラウンドが入力中のときだけ保存する. 既にあれば上書きする.
 *
 * 入力中かを確かめることと保存を 1 つの SQL で行い, 確定と同時に送られても
 * 確定したラウンドが変わらないようにする.
 * @param db D1 のデータベース.
 * @param entry 保存する持ち点. 値は検証済みのもの.
 * @returns 保存できたら true. ラウンドが入力中でなければ false.
 */
export async function upsertEntryIfOpen(
  db: D1Database,
  entry: EntryRecord,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO entries (round_id, player_id, points)
       SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM rounds WHERE id = ? AND status = 'open')
       ON CONFLICT (round_id, player_id) DO UPDATE SET points = excluded.points`,
    )
    .bind(entry.roundId, entry.playerId, entry.points, entry.roundId)
    .run();
  return result.meta.changes === 1;
}
