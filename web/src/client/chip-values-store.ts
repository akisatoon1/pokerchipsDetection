import {
  readStoredChipValues,
  toStoredChipValues,
  type ChipValues,
} from "../rules/chip-values";

// 色ごとの点数は, ブラウザに 1 つだけ持つ. バックエンドには換算を置かないため (docs/web/app.md).
const STORAGE_KEY = "pokerchip:chip-values";

/**
 * ブラウザに保存した色ごとの点数を読む.
 *
 * @returns 色ごとの点数. 保存していない, 読めない, 壊れているときは空. 範囲外の値は決めていないものとして扱う.
 */
export function loadChipValues(): ChipValues {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return new Map();
  }
  if (raw === null) {
    return new Map();
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return readStoredChipValues(parsed);
  } catch {
    // 壊れた値は, 保存していないものとして扱う.
    return new Map();
  }
}

/**
 * 色ごとの点数をブラウザに保存する. 前に保存したものは置き換える.
 *
 * @param values 色ごとの点数. 入っていない色は使わない色として保存する.
 * @throws ブラウザが保存を許さないとき (プライベートモードなど).
 */
export function saveChipValues(values: ChipValues): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredChipValues(values)));
}
