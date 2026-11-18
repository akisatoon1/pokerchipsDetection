import { describe, expect, it } from "vitest";
import {
  CHIP_COLORS,
  findChipColor,
  parseChipValue,
  readStoredChipValues,
  toChipValuesRecord,
  toStoredChipValues,
  validateChipValues,
  type ChipColorName,
} from "../src/rules/chip-values";

describe("チップの色の一覧", () => {
  it("core が判定する 7 色を, 画面に出す順に持つ", () => {
    expect(CHIP_COLORS.map((color) => color.name)).toEqual([
      "red",
      "blue",
      "yellow",
      "black",
      "gray",
      "purple",
      "green",
    ]);
  });

  it("core の色の名前から色を引ける", () => {
    expect(findChipColor("gray")?.label).toBe("灰 (白)");
  });

  it("unknown や知らない名前は見つからない", () => {
    expect(findChipColor("unknown")).toBeNull();
    expect(findChipColor("white")).toBeNull();
    expect(findChipColor("")).toBeNull();
  });
});

describe("色の欄の文字を読む", () => {
  it("空欄は使わない色として受け付ける", () => {
    expect(parseChipValue("")).toEqual({ ok: true, value: null });
    expect(parseChipValue("   ")).toEqual({ ok: true, value: null });
  });

  it("前後の空白を除いて読む", () => {
    expect(parseChipValue(" 100 ")).toEqual({ ok: true, value: 100 });
  });

  it("1 と 1,000,000,000 は受け付ける", () => {
    expect(parseChipValue("1")).toEqual({ ok: true, value: 1 });
    expect(parseChipValue("1000000000")).toEqual({
      ok: true,
      value: 1_000_000_000,
    });
  });

  it("0 と 1,000,000,001 は拒否する", () => {
    expect(parseChipValue("0")).toEqual({
      ok: false,
      reason: "1 以上の整数を入れてください",
    });
    expect(parseChipValue("1000000001")).toEqual({
      ok: false,
      reason: "1,000,000,000 以下にしてください",
    });
    expect(parseChipValue("99999999999999999999999").ok).toBe(false);
  });

  it("小数, 符号, 指数, 全角の数字, 区切り, 文字は拒否する", () => {
    for (const text of ["1.5", "+1", "-1", "1e3", "１００", "1,000", "abc"]) {
      expect(parseChipValue(text).ok, text).toBe(false);
    }
  });
});

describe("送られた色ごとの点数を確かめる", () => {
  it("1 色だけでも受け付け, 色の一覧の順に並べる", () => {
    const result = validateChipValues({ green: 25, red: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.value]).toEqual([
        ["red", 100],
        ["green", 25],
      ]);
    }
    expect(validateChipValues({ blue: 500 }).ok).toBe(true);
  });

  it("1 と 1,000,000,000 は受け付ける", () => {
    expect(validateChipValues({ red: 1, blue: 1_000_000_000 }).ok).toBe(true);
  });

  it("1 色もなければ拒否する", () => {
    expect(validateChipValues({}).ok).toBe(false);
  });

  it("0, 1,000,000,001, 小数, 負の数は拒否する", () => {
    for (const value of [0, 1_000_000_001, 1.5, -100, Number.NaN]) {
      expect(validateChipValues({ red: 100, blue: value }).ok).toBe(false);
    }
  });
});

describe("色ごとの点数を, 送る形にする", () => {
  it("色の一覧の順に並べ, 使わない色は入れない", () => {
    const values = new Map<ChipColorName, number>([
      ["green", 25],
      ["red", 100],
    ]);
    const record = toChipValuesRecord(values);
    expect(record).toEqual({ red: 100, green: 25 });
    expect(Object.keys(record)).toEqual(["red", "green"]);
  });
});

describe("保存した点数を読む", () => {
  it("保存した形に戻せる", () => {
    const values = new Map<ChipColorName, number>([
      ["red", 100],
      ["gray", 1_000_000_000],
    ]);
    expect(readStoredChipValues(toStoredChipValues(values))).toEqual(values);
  });

  it("範囲外の値, 整数でない値, 知らない色は決めていないものとして読む", () => {
    const stored = {
      red: 0,
      blue: 1_000_000_001,
      yellow: 1.5,
      black: "100",
      gray: null,
      purple: 500,
      unknown: 100,
    };
    expect(readStoredChipValues(stored)).toEqual(new Map([["purple", 500]]));
  });

  it("オブジェクトでなければ空として読む", () => {
    for (const stored of [null, 100, "red", undefined]) {
      expect(readStoredChipValues(stored).size).toBe(0);
    }
  });
});
