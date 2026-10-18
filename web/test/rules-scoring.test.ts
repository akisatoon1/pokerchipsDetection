import { describe, expect, it } from "vitest";
import { validatePoints } from "../src/rules/points";
import { scoreRound } from "../src/rules/scoring";

describe("持ち点", () => {
  it("0 と 1,000,000,000 なら受け付ける", () => {
    expect(validatePoints(0)).toEqual({ ok: true, value: 0 });
    expect(validatePoints(1_000_000_000).ok).toBe(true);
  });

  it("負の数, 小数, 1,000,000,001 なら拒否する", () => {
    expect(validatePoints(-1).ok).toBe(false);
    expect(validatePoints(0.5).ok).toBe(false);
    expect(validatePoints(1_000_000_001).ok).toBe(false);
  });
});

describe("ラウンドの増減", () => {
  const playerIds = ["A", "B", "C"];

  it("増減は持ち点 − 初期点数になる", () => {
    const result = scoreRound({
      initialPoints: 100,
      playerIds,
      pointsByPlayer: new Map([
        ["A", 150],
        ["B", 150],
        ["C", 0],
      ]),
    });
    expect(result.scores).toEqual([
      { playerId: "A", points: 150, delta: 50 },
      { playerId: "B", points: 150, delta: 50 },
      { playerId: "C", points: 0, delta: -100 },
    ]);
    expect(result.isComplete).toBe(true);
    expect(result.hasTotalMismatch).toBe(false);
  });

  it("入れていない人は未入力 (null) になる", () => {
    const result = scoreRound({
      initialPoints: 100,
      playerIds,
      pointsByPlayer: new Map([["B", 80]]),
    });
    expect(result.scores).toEqual([
      { playerId: "A", points: null, delta: null },
      { playerId: "B", points: 80, delta: -20 },
      { playerId: "C", points: null, delta: null },
    ]);
    expect(result.isComplete).toBe(false);
  });

  it("全員がそろい, 合計が S × n でなければ警告の印が付く", () => {
    const result = scoreRound({
      initialPoints: 100,
      playerIds,
      pointsByPlayer: new Map([
        ["A", 100],
        ["B", 100],
        ["C", 101],
      ]),
    });
    expect(result.hasTotalMismatch).toBe(true);
    expect(result.totalPoints).toBe(301);
    expect(result.expectedTotalPoints).toBe(300);
  });

  it("そろっていないうちは合計を検査しない", () => {
    const result = scoreRound({
      initialPoints: 100,
      playerIds,
      pointsByPlayer: new Map([
        ["A", 100],
        ["B", 100],
      ]),
    });
    expect(result.hasTotalMismatch).toBe(false);
  });

  it("上限の値でも合計を誤差なく計算する", () => {
    const ids = Array.from({ length: 10 }, (_, index) => `P${String(index)}`);
    const result = scoreRound({
      initialPoints: 1_000_000_000,
      playerIds: ids,
      pointsByPlayer: new Map(ids.map((id) => [id, 1_000_000_000])),
    });
    expect(result.totalPoints).toBe(10_000_000_000);
    expect(result.hasTotalMismatch).toBe(false);
  });
});
