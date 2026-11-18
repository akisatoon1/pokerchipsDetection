import { MAX_POINTS } from "./limits";
import type { RuleResult } from "./rule-result";

/**
 * core の chipColorName が返す色の名前の一覧. `unknown` (判定できなかった) は含めない.
 *
 * API の入口で色の名前を確かめる (zod の enum に渡す) ため, 型だけでなく値でも持つ.
 */
export const CHIP_COLOR_NAMES = [
  "red",
  "blue",
  "yellow",
  "black",
  "gray",
  "purple",
  "green",
] as const;

/** core の chipColorName が返す色の名前. `unknown` (判定できなかった) は含めない. */
export type ChipColorName = (typeof CHIP_COLOR_NAMES)[number];

/** core が判定するチップの色. */
export interface ChipColor {
  /** core の chipColorName が返す名前. 保存のキーにも使う. */
  name: ChipColorName;
  /** 画面に出す名前. */
  label: string;
  /** 見本の色 (CSS の色). core の chipColorBgr と同じ値. */
  swatch: string;
}

/**
 * core が判定する 7 色. 並びは画面に出す順 (Android の ChipColor と同じ).
 *
 * 色を足すのは core の基準色を作り直すときなので, 画面の中では足せないようにする (docs/web/app.md).
 */
export const CHIP_COLORS: readonly ChipColor[] = [
  { name: "red", label: "赤", swatch: "#dc0000" },
  { name: "blue", label: "青", swatch: "#0050dc" },
  { name: "yellow", label: "黄", swatch: "#f0dc00" },
  { name: "black", label: "黒", swatch: "#000000" },
  // 実物のチップでは白に見える. 見本と並べて, どのチップのことか分かるようにする.
  { name: "gray", label: "灰 (白)", swatch: "#808080" },
  { name: "purple", label: "紫", swatch: "#8c00b4" },
  { name: "green", label: "緑", swatch: "#00b400" },
];

/**
 * 色ごとの点数 (1 以上 MAX_POINTS 以下). 入っていない色は「このチップセットでは使わない色」.
 *
 * マッチごとに持ち, マッチの全員が同じものを使う (docs/web/app.md).
 */
export type ChipValues = ReadonlyMap<ChipColorName, number>;

/** 色ごとの点数を, 色の名前から点数への対応にしたもの. API で送り, 返す形. */
export type ChipValuesRecord = Partial<Record<ChipColorName, number>>;

/**
 * core の色の名前から色を探す.
 *
 * @param name core の chipColorName が返す名前.
 * @returns 色. `unknown` など, 7 色にない名前なら null.
 */
export function findChipColor(name: string): ChipColor | null {
  return CHIP_COLORS.find((color) => color.name === name) ?? null;
}

/**
 * 設定画面で 1 つの色の欄に入れた文字を読む.
 *
 * 前後の空白は除く. 空欄は使わない色とし, それ以外は 1 以上 MAX_POINTS 以下の整数だけを受け付ける.
 * チップの点数は整数なので, 小数は受け付けない (docs/web/scoring.md).
 * @param text 欄に入れた文字.
 * @returns 点数. 空欄なら null. 受け付けられなければ ok: false と, その欄に出す理由.
 */
export function parseChipValue(text: string): RuleResult<number | null> {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  // 符号, 小数点, 指数, 全角の数字などを先に弾く. Number は "+1" や "1e3" も読んでしまうため.
  if (!/^[0-9]+$/.test(trimmed)) {
    return { ok: false, reason: "1 以上の整数を入れてください" };
  }
  const value = Number(trimmed);
  if (value < 1) {
    return { ok: false, reason: "1 以上の整数を入れてください" };
  }
  if (value > MAX_POINTS) {
    return { ok: false, reason: "1,000,000,000 以下にしてください" };
  }
  return { ok: true, value };
}

/**
 * 送られた色ごとの点数が決まりを満たすかを確かめる.
 *
 * 1 色につき 1 以上 MAX_POINTS 以下の整数で, 少なくとも 1 色は決める (docs/web/app.md).
 * 1 色もなければ, チップから入力できないため.
 * @param record 色の名前から点数への対応. 色の名前と, 値が数であることは確かめてあるもの.
 * @returns 色ごとの点数 (色の一覧の順). 決まりを満たさなければ ok: false と理由.
 */
export function validateChipValues(
  record: ChipValuesRecord,
): RuleResult<ChipValues> {
  const values = chipValuesFromRecord(record);
  if (values.size === 0) {
    return { ok: false, reason: "チップの点数を少なくとも 1 色決めてください" };
  }
  for (const value of values.values()) {
    if (!isChipValue(value)) {
      return {
        ok: false,
        reason: `チップの点数は 1 以上 ${String(MAX_POINTS)} 以下の整数にしてください`,
      };
    }
  }
  return { ok: true, value: values };
}

/**
 * 色の名前から点数への対応を, 色ごとの点数にする. 値の範囲は確かめない.
 *
 * @param record 色の名前から点数への対応.
 * @returns 色ごとの点数. 色の一覧の順に並べる.
 */
export function chipValuesFromRecord(record: ChipValuesRecord): ChipValues {
  const values = new Map<ChipColorName, number>();
  for (const color of CHIP_COLORS) {
    const value = record[color.name];
    if (value !== undefined) {
      values.set(color.name, value);
    }
  }
  return values;
}

/**
 * 色ごとの点数を, 色の名前から点数への対応にする. API で送り, 返すため.
 *
 * @param values 色ごとの点数.
 * @returns 色の名前から点数への対応. 色の一覧の順に並べる.
 */
export function toChipValuesRecord(values: ChipValues): ChipValuesRecord {
  const record: ChipValuesRecord = {};
  for (const color of CHIP_COLORS) {
    const value = values.get(color.name);
    if (value !== undefined) {
      record[color.name] = value;
    }
  }
  return record;
}

function isChipValue(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MAX_POINTS;
}
