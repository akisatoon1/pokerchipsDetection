import { MAX_MATCH_NAME_LENGTH, MAX_PLAYER_NAME_LENGTH } from "./limits";
import type { RuleResult } from "./rule-result";

/**
 * プレイヤーの名前を確かめ, 保存する形にそろえる.
 *
 * 前後の空白を除いてから, 1〜20 文字かを確かめる. 同じマッチでの重なりは DB の制約で確かめる.
 * @param rawName 利用者が入れた名前.
 * @returns 前後の空白を除いた名前. 決まりを満たさなければ ok: false と理由.
 */
export function normalizePlayerName(rawName: string): RuleResult<string> {
  return normalizeText(rawName, MAX_PLAYER_NAME_LENGTH, "名前");
}

/**
 * マッチ名を確かめ, 保存する形にそろえる.
 *
 * 前後の空白を除いてから, 1〜40 文字かを確かめる.
 * @param rawName 利用者が入れたマッチ名.
 * @returns 前後の空白を除いたマッチ名. 決まりを満たさなければ ok: false と理由.
 */
export function normalizeMatchName(rawName: string): RuleResult<string> {
  return normalizeText(rawName, MAX_MATCH_NAME_LENGTH, "マッチ名");
}

function normalizeText(
  rawText: string,
  maxLength: number,
  label: string,
): RuleResult<string> {
  const text = rawText.trim();
  const length = countCharacters(text);
  if (length === 0) {
    return { ok: false, reason: `${label}を入れてください` };
  }
  if (length > maxLength) {
    return {
      ok: false,
      reason: `${label}は ${String(maxLength)} 文字までです`,
    };
  }
  return { ok: true, value: text };
}

/**
 * 見た目の 1 文字を 1 と数える.
 *
 * UTF-16 の長さ (String.length) では絵文字や結合文字が 2 以上に数えられ,
 * 利用者の思う文字数と食い違うため, 書記素 (grapheme) の数を使う.
 */
function countCharacters(text: string): number {
  const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
  return Array.from(segmenter.segment(text)).length;
}
