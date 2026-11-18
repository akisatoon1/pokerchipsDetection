import type { ChipValues } from "../../rules/chip-values";

/** DB に保存したマッチ. */
export interface MatchRecord {
  id: string;
  name: string;
  initialPoints: number;
  leaderPlayerId: string;
}

/** DB に保存した, マッチの 1 つの色の点数. 色は DB の制約で 7 色のどれか. */
export interface ChipValueRecord {
  color: string;
  points: number;
}

/** 新しいマッチと, それを作ったリーダーのプレイヤー. 値は検証済みのもの. */
export interface NewMatch {
  matchId: string;
  matchName: string;
  initialPoints: number;
  leaderPlayerId: string;
  leaderName: string;
  leaderTokenHash: string;
  chipValues: ChipValues;
}

/**
 * マッチと, リーダーのプレイヤーと, 色ごとの点数を 1 つのトランザクションで保存する.
 *
 * 一部だけが保存されてリーダーのいないマッチなどができないようにするため, batch でまとめる.
 * @param db D1 のデータベース.
 * @param match 保存するマッチとリーダーと色ごとの点数.
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
    ...insertChipValueStatements(db, match.matchId, match.chipValues),
  ]);
}

/**
 * マッチの色ごとの点数を読む.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id.
 * @returns 色ごとの点数. 決めていない (この表より前に作った) マッチなら空.
 */
export async function listChipValues(
  db: D1Database,
  matchId: string,
): Promise<ChipValueRecord[]> {
  // 並びは API の側で色の一覧の順にそろえるので, ここでは決めない.
  const { results } = await db
    .prepare("SELECT color, points FROM match_chip_values WHERE match_id = ?")
    .bind(matchId)
    .all<ChipValueRecord>();
  return results;
}

function insertChipValueStatements(
  db: D1Database,
  matchId: string,
  chipValues: ChipValues,
): D1PreparedStatement[] {
  return [...chipValues].map(([color, points]) =>
    db
      .prepare(
        "INSERT INTO match_chip_values (match_id, color, points) VALUES (?, ?, ?)",
      )
      .bind(matchId, color, points),
  );
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
 * マッチと, そのプレイヤー, ラウンド, 持ち点, 色ごとの点数を 1 つのトランザクションですべて消す.
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
  // 外部キーで参照される側を後に消す. entries は rounds と players を,
  // その 2 つと match_chip_values は matches を参照している.
  await db.batch([
    db
      .prepare("DELETE FROM match_chip_values WHERE match_id = ?")
      .bind(matchId),
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
