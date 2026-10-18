import { describe, expect, it } from "vitest";
import { checkCanCloseRound } from "../src/rules/rounds";
import { computeTotals, scoreRound } from "../src/rules/scoring";

describe("ラウンドを確定できるか", () => {
  it("入力中で全員がそろっていれば確定できる", () => {
    expect(checkCanCloseRound({ isOpen: true, isComplete: true }).ok).toBe(
      true,
    );
  });

  it("未入力の人がいたら確定できない", () => {
    expect(checkCanCloseRound({ isOpen: true, isComplete: false }).ok).toBe(
      false,
    );
  });

  it("確定したラウンドはもう一度確定できない", () => {
    expect(checkCanCloseRound({ isOpen: false, isComplete: true }).ok).toBe(
      false,
    );
  });
});

describe("累計", () => {
  const playerIds = ["A", "B", "C"];

  function round(points: [number, number, number], isClosed: boolean) {
    const { scores } = scoreRound({
      initialPoints: 100,
      playerIds,
      pointsByPlayer: new Map([
        ["A", points[0]],
        ["B", points[1]],
        ["C", points[2]],
      ]),
    });
    return { isClosed, scores };
  }

  it("scoring.md の例で +30, +50, −80 になる", () => {
    const totals = computeTotals(playerIds, [
      round([150, 150, 0], true),
      round([80, 100, 120], true),
    ]);
    expect(totals).toEqual([
      { playerId: "A", total: 30 },
      { playerId: "B", total: 50 },
      { playerId: "C", total: -80 },
    ]);
  });

  it("入力中のラウンドは累計に入らない", () => {
    const totals = computeTotals(playerIds, [
      round([150, 150, 0], true),
      round([80, 100, 120], false),
    ]);
    expect(totals.map((total) => total.total)).toEqual([50, 50, -100]);
  });

  it("確定したラウンドがなければ全員 0", () => {
    expect(computeTotals(playerIds, []).map((total) => total.total)).toEqual([
      0, 0, 0,
    ]);
  });
});
