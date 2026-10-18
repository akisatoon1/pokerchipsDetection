/** DB に保存したマッチ. */
export interface MatchRecord {
  id: string;
  name: string;
  initialPoints: number;
  leaderPlayerId: string;
}

/** 新しいマッチと, それを作ったリーダーのプレイヤー. 値は検証済みのもの. */
export interface NewMatch {
  matchId: string;
  matchName: string;
  initialPoints: number;
  leaderPlayerId: string;
  leaderName: string;
  leaderTokenHash: string;
}

/**
 * マッチと, リーダーのプレイヤーを 1 つのトランザクションで保存する.
 *
 * 片方だけが保存されてリーダーのいないマッチができないようにするため, batch でまとめる.
 * @param db D1 のデータベース.
 * @param match 保存するマッチとリーダー.
 * @throws DB の制約に反したときや, DB に届かないとき.
 */
export async function insertMatchWithLeader(
  db: D1Database,
  match: NewMatch,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        "INSERT INTO matches (id, name, initial_points, leader_player_id) VALUES (?, ?, ?, ?)",
      )
      .bind(
        match.matchId,
        match.matchName,
        match.initialPoints,
        match.leaderPlayerId,
      ),
    db
      .prepare(
        "INSERT INTO players (id, match_id, name, token_hash, position) VALUES (?, ?, ?, ?, 1)",
      )
      .bind(
        match.leaderPlayerId,
        match.matchId,
        match.leaderName,
        match.leaderTokenHash,
      ),
  ]);
}

/**
 * マッチを id で探す.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @returns 見つかったマッチ. なければ null.
 */
export async function findMatch(
  db: D1Database,
  matchId: string,
): Promise<MatchRecord | null> {
  return db
    .prepare(
      "SELECT id, name, initial_points AS initialPoints, leader_player_id AS leaderPlayerId FROM matches WHERE id = ?",
    )
    .bind(matchId)
    .first<MatchRecord>();
}
