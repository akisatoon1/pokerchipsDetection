import { findPlayerByTokenHash, type PlayerRecord } from "../db/players";
import { hashToken } from "../secrets";

/** トークンの形. 128 ビットを base64url にした 22 文字. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * リクエストを送ったプレイヤーを, Authorization ヘッダのトークンから探す.
 *
 * 本人かリーダーかの確認は, 画面ではなく毎回ここで行う (docs/web/security.md).
 * @param db D1 のデータベース.
 * @param request 届いたリクエスト.
 * @param matchId マッチの id. 別のマッチのトークンでは見つからない.
 * @returns 送ったプレイヤー. トークンがない, 形が違う, 見つからないときは null.
 */
export async function findRequestingPlayer(
  db: D1Database,
  request: Request,
  matchId: string,
): Promise<PlayerRecord | null> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  if (!TOKEN_PATTERN.test(token)) {
    return null;
  }
  return findPlayerByTokenHash(db, matchId, await hashToken(token));
}
