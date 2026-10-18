import { describe, expect, it } from "vitest";
import { validateInitialPoints } from "../src/rules/points";

describe("初期点数", () => {
  it("1 と 1,000,000,000 なら受け付ける", () => {
    expect(validateInitialPoints(1)).toEqual({ ok: true, value: 1 });
    expect(validateInitialPoints(1_000_000_000).ok).toBe(true);
  });

  it("0 と負の数なら拒否する", () => {
    expect(validateInitialPoints(0).ok).toBe(false);
    expect(validateInitialPoints(-100).ok).toBe(false);
  });

  it("小数なら拒否する", () => {
    expect(validateInitialPoints(1.5).ok).toBe(false);
  });

  it("1,000,000,001 なら拒否する", () => {
    expect(validateInitialPoints(1_000_000_001).ok).toBe(false);
  });

  it("NaN と Infinity なら拒否する", () => {
    expect(validateInitialPoints(Number.NaN).ok).toBe(false);
    expect(validateInitialPoints(Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});
