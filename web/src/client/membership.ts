/** このブラウザが, あるマッチでどのプレイヤーかを表す. */
export interface Membership {
  playerId: string;
  token: string;
}

function storageKey(matchId: string): string {
  return `pokerchip:match:${matchId}`;
}

/**
 * マッチに参加したときのトークンをブラウザに保存する.
 *
 * ログインがないので, 本人の確認はここに保存したトークンで行う (docs/web/app.md).
 * @param matchId マッチの id.
 * @param membership プレイヤーの id とトークン.
 * @throws ブラウザが保存を許さないとき (プライベートモードなど).
 */
export function saveMembership(matchId: string, membership: Membership): void {
  localStorage.setItem(storageKey(matchId), JSON.stringify(membership));
}

/**
 * 保存したトークンを読む.
 *
 * @param matchId マッチの id.
 * @returns 保存したもの. なければ, または読めなければ null.
 */
export function loadMembership(matchId: string): Membership | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(matchId));
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "playerId" in parsed &&
      "token" in parsed &&
      typeof parsed.playerId === "string" &&
      typeof parsed.token === "string"
    ) {
      return { playerId: parsed.playerId, token: parsed.token };
    }
  } catch {
    // 壊れた値は, 保存していないものとして扱う.
  }
  return null;
}

/**
 * 保存したトークンを消す.
 *
 * マッチを削除したときに使う. 消すと, このブラウザはそのマッチの本人として戻れなくなる.
 * @param matchId マッチの id.
 */
export function removeMembership(matchId: string): void {
  try {
    localStorage.removeItem(storageKey(matchId));
  } catch {
    // 保存を許さないブラウザなら, もともと保存されていない.
  }
}
