/** DB に保存したプレイヤー. トークンのハッシュは含めない. */
export interface PlayerRecord {
  id: string;
  name: string;
}

/**
 * マッチのプレイヤーを参加した順に返す.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @returns プレイヤーの一覧. マッチがなければ空.
 */
export async function listPlayers(
  db: D1Database,
  matchId: string,
): Promise<PlayerRecord[]> {
  const { results } = await db
    .prepare(
      "SELECT id, name FROM players WHERE match_id = ? ORDER BY position",
    )
    .bind(matchId)
    .all<PlayerRecord>();
  return results;
}
