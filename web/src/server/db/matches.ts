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

/**
 * マッチと, そのプレイヤー, ラウンド, 持ち点を 1 つのトランザクションですべて消す.
 *
 * 元に戻す手段は持たない仕様なので, 消したことにして残すのではなく, 行そのものを消す (docs/web/app.md).
 * 途中で失敗して一部だけが残らないよう, batch でまとめる.
 * @param db D1 のデータベース.
 * @param matchId マッチの id. なければ何も消さない.
 * @throws DB に届かないとき.
 */
export async function deleteMatchWithEverything(
  db: D1Database,
  matchId: string,
): Promise<void> {
  // 外部キーで参照される側を後に消す. entries は rounds と players を, その 2 つは matches を参照している.
  await db.batch([
    db
      .prepare(
        "DELETE FROM entries WHERE round_id IN (SELECT id FROM rounds WHERE match_id = ?)",
      )
      .bind(matchId),
    db.prepare("DELETE FROM rounds WHERE match_id = ?").bind(matchId),
    db.prepare("DELETE FROM players WHERE match_id = ?").bind(matchId),
    db.prepare("DELETE FROM matches WHERE id = ?").bind(matchId),
  ]);
}
