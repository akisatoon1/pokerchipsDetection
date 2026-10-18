import { describe, expect, it } from "vitest";
import { parseMatchUrl } from "../src/rules/match-url";

const SITE = "https://score.example.com";

describe("貼られたマッチの URL", () => {
  it("このサイトの /m/<id> から id を取り出す", () => {
    expect(parseMatchUrl(`${SITE}/m/abc_DEF-123`, SITE)).toEqual({
      ok: true,
      value: "abc_DEF-123",
    });
  });

  it("末尾の / があってもよい", () => {
    expect(parseMatchUrl(`${SITE}/m/abc/`, SITE)).toEqual({
      ok: true,
      value: "abc",
    });
  });

  it("前後の空白と改行を除く", () => {
    expect(parseMatchUrl(`  ${SITE}/m/abc\n`, SITE)).toEqual({
      ok: true,
      value: "abc",
    });
  });

  it("クエリと # 以降は見ない", () => {
    expect(parseMatchUrl(`${SITE}/m/abc?x=1#top`, SITE)).toEqual({
      ok: true,
      value: "abc",
    });
  });

  it("ポートを含むサイトでも, 同じポートなら受け付ける", () => {
    const local = "http://localhost:8787";
    expect(parseMatchUrl(`${local}/m/abc`, local)).toEqual({
      ok: true,
      value: "abc",
    });
  });

  it("別のサイトの URL は拒否する", () => {
    expect(parseMatchUrl("https://evil.example.com/m/abc", SITE).ok).toBe(
      false,
    );
  });

  it("同じホストでも, 別のポートや別の scheme なら拒否する", () => {
    expect(parseMatchUrl("https://score.example.com:8443/m/abc", SITE).ok).toBe(
      false,
    );
    expect(parseMatchUrl("http://score.example.com/m/abc", SITE).ok).toBe(
      false,
    );
  });

  it("/m/<id> 以外のパスは拒否する", () => {
    expect(parseMatchUrl(`${SITE}/`, SITE).ok).toBe(false);
    expect(parseMatchUrl(`${SITE}/m/`, SITE).ok).toBe(false);
    expect(parseMatchUrl(`${SITE}/m/abc/x`, SITE).ok).toBe(false);
    expect(parseMatchUrl(`${SITE}/api/matches/abc`, SITE).ok).toBe(false);
  });

  it("空や URL でない文字は拒否する", () => {
    expect(parseMatchUrl("", SITE).ok).toBe(false);
    expect(parseMatchUrl("   ", SITE).ok).toBe(false);
    expect(parseMatchUrl("abc", SITE).ok).toBe(false);
    expect(parseMatchUrl("/m/abc", SITE).ok).toBe(false);
  });

  it("id の % の形が壊れていたら拒否する", () => {
    expect(parseMatchUrl(`${SITE}/m/%E3%81`, SITE).ok).toBe(false);
  });
});
