// 識別子とトークンの作り方 (docs/web/security.md).

/** 識別子とトークンの乱数のバイト数. 128 ビット. */
const RANDOM_BYTES = 16;

/**
 * 推測できない乱数の文字列を作る. マッチやプレイヤーの id とトークンに使う.
 *
 * @returns 128 ビットの暗号用の乱数を base64url にした 22 文字.
 */
export function createRandomId(): string {
  const bytes = new Uint8Array(RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  // URL にそのまま入れられるよう, base64 の + / を - _ に替え, 末尾の = を除く.
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * トークンを DB に保存する形 (SHA-256 の 16 進) にする.
 *
 * トークンは十分に長い乱数なので, 遅いハッシュ関数でなくても総当たりで戻せない.
 * @param token 利用者に渡したトークン.
 * @returns 64 文字の 16 進の文字列.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
