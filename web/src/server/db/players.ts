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

/** 参加するプレイヤー. 値は検証済みのもの. */
export interface NewPlayer {
  playerId: string;
  matchId: string;
  name: string;
  tokenHash: string;
}

/** 参加を保存した結果. */
export type InsertPlayerOutcome =
  "inserted" | "not-allowed" | "name-taken" | "busy";

/**
 * プレイヤーを, 人数が上限に届いておらず, ラウンドもまだ始まっていないときだけ保存する.
 *
 * 参加できるかの判定は rules/players.ts で済ませておく. ここの条件は, 同時に参加や
 * ラウンドの開始が送られても決まりを破らないための最後の守り.
 * @param db D1 のデータベース.
 * @param player 保存するプレイヤー.
 * @param maxPlayers 1 つのマッチのプレイヤーの上限.
 * @returns 保存できたか. 条件を満たさなければ "not-allowed", 同じマッチに同じ名前があれば
 *   "name-taken", 同時に参加した人と参加の順番がぶつかったら "busy".
 * @throws DB に届かないときや, 思わぬ制約に反したとき.
 */
export async function insertPlayerIfAllowed(
  db: D1Database,
  player: NewPlayer,
  maxPlayers: number,
): Promise<InsertPlayerOutcome> {
  try {
    const result = await db
      .prepare(
        `INSERT INTO players (id, match_id, name, token_hash, position)
         SELECT ?, ?, ?, ?, COUNT(*) + 1 FROM players WHERE match_id = ?
         HAVING COUNT(*) < ?
           AND NOT EXISTS (SELECT 1 FROM rounds WHERE match_id = ?)`,
      )
      .bind(
        player.playerId,
        player.matchId,
        player.name,
        player.tokenHash,
        player.matchId,
        maxPlayers,
        player.matchId,
      )
      .run();
    return result.meta.changes === 1 ? "inserted" : "not-allowed";
  } catch (error) {
    if (isUniqueViolation(error, "players.match_id, players.name")) {
      return "name-taken";
    }
    if (isUniqueViolation(error, "players.match_id, players.position")) {
      return "busy";
    }
    throw error;
  }
}

/**
 * トークンのハッシュから, マッチのプレイヤーを探す.
 *
 * @param db D1 のデータベース.
 * @param matchId マッチの id. 別のマッチのトークンでは見つからない.
 * @param tokenHash トークンの SHA-256.
 * @returns 見つかったプレイヤー. なければ null.
 */
export async function findPlayerByTokenHash(
  db: D1Database,
  matchId: string,
  tokenHash: string,
): Promise<PlayerRecord | null> {
  return db
    .prepare(
      "SELECT id, name FROM players WHERE match_id = ? AND token_hash = ?",
    )
    .bind(matchId, tokenHash)
    .first<PlayerRecord>();
}

/**
 * D1 の例外が, 指定した列の UNIQUE 制約に反したものかを調べる.
 *
 * D1 は制約の違反を例外の文言でしか伝えないため, 文言を見る.
 * @param error 捕まえた例外.
 * @param columns SQLite が文言に入れる列の並び (例: "players.match_id, players.name").
 * @returns その制約に反したものなら true.
 */
export function isUniqueViolation(error: unknown, columns: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(`UNIQUE constraint failed: ${columns}`)
  );
}
