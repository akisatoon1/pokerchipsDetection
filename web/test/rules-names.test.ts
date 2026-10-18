import { describe, expect, it } from "vitest";
import { normalizeMatchName, normalizePlayerName } from "../src/rules/names";

describe("プレイヤーの名前", () => {
  it("空なら拒否する", () => {
    expect(normalizePlayerName("").ok).toBe(false);
  });

  it("空白だけなら拒否する", () => {
    expect(normalizePlayerName("  　 ").ok).toBe(false);
  });

  it("1 文字と 20 文字なら受け付ける", () => {
    expect(normalizePlayerName("a")).toEqual({ ok: true, value: "a" });
    const name = "あ".repeat(20);
    expect(normalizePlayerName(name)).toEqual({ ok: true, value: name });
  });

  it("21 文字なら拒否する", () => {
    expect(normalizePlayerName("あ".repeat(21)).ok).toBe(false);
  });

  it("前後の空白を除く", () => {
    expect(normalizePlayerName("  太郎 ")).toEqual({ ok: true, value: "太郎" });
  });

  it("前後の空白を除いてから文字数を数える", () => {
    expect(normalizePlayerName(` ${"a".repeat(20)} `).ok).toBe(true);
  });

  it("絵文字や結合した文字は見た目の 1 文字を 1 と数える", () => {
    expect(normalizePlayerName("😀".repeat(20)).ok).toBe(true);
    expect(normalizePlayerName("👨‍👩‍👧".repeat(20)).ok).toBe(true);
    expect(normalizePlayerName("👨‍👩‍👧".repeat(21)).ok).toBe(false);
  });
});

describe("マッチ名", () => {
  it("空なら拒否する", () => {
    expect(normalizeMatchName(" ").ok).toBe(false);
  });

  it("40 文字なら受け付け, 41 文字なら拒否する", () => {
    expect(normalizeMatchName("x".repeat(40)).ok).toBe(true);
    expect(normalizeMatchName("x".repeat(41)).ok).toBe(false);
  });
});
