import type { RuleResult } from "./rule-result";

/** マッチの画面のパス. `/m/{matchId}` で, 末尾の `/` はあってもよい. */
const MATCH_PATH = /^\/m\/([^/]+)\/?$/;

/**
 * 貼られた URL から, このサイトのマッチの id を取り出す.
 *
 * 受け付けるのは, このサイトと同じ scheme, ホスト, ポートの `/m/{matchId}` だけにする (docs/web/app.md).
 * 別のサイトの URL を開かせないため. クエリと `#` 以降は見ない.
 * @param rawInput 利用者が貼った文字. 前後の空白は除く.
 * @param siteOrigin このサイトのオリジン (`https://example.com` の形).
 * @returns マッチの id. このサイトのマッチの URL でなければ ok: false と理由.
 */
export function parseMatchUrl(
  rawInput: string,
  siteOrigin: string,
): RuleResult<string> {
  const input = rawInput.trim();
  if (input === "") {
    return { ok: false, reason: "マッチの URL を貼ってください" };
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "URL の形になっていません" };
  }
  if (url.origin !== siteOrigin) {
    return { ok: false, reason: "このサイトのマッチの URL ではありません" };
  }
  const encodedId = MATCH_PATH.exec(url.pathname)?.[1];
  if (encodedId === undefined) {
    return { ok: false, reason: "マッチの URL ではありません" };
  }
  try {
    return { ok: true, value: decodeURIComponent(encodedId) };
  } catch {
    return { ok: false, reason: "マッチの URL ではありません" };
  }
}
