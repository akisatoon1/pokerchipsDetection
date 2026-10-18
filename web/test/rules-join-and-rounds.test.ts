import { describe, expect, it } from "vitest";
import { checkCanJoin } from "../src/rules/players";
import { checkCanStartRound } from "../src/rules/rounds";

describe("参加できるか", () => {
  it("ラウンドを始める前で 9 人なら参加できる", () => {
    expect(checkCanJoin({ playerCount: 9, hasRoundStarted: false }).ok).toBe(
      true,
    );
  });

  it("10 人いたら参加できない", () => {
    expect(checkCanJoin({ playerCount: 10, hasRoundStarted: false }).ok).toBe(
      false,
    );
  });

  it("最初のラウンドを始めたあとは参加できない", () => {
    expect(checkCanJoin({ playerCount: 2, hasRoundStarted: true }).ok).toBe(
      false,
    );
  });
});

describe("ラウンドを始められるか", () => {
  it("2 人いて入力中のラウンドがなければ始められる", () => {
    expect(
      checkCanStartRound({
        playerCount: 2,
        hasOpenRound: false,
        confirmedPlayerCount: 2,
      }).ok,
    ).toBe(true);
  });

  it("1 人なら始められない", () => {
    expect(
      checkCanStartRound({
        playerCount: 1,
        hasOpenRound: false,
        confirmedPlayerCount: 1,
      }).ok,
    ).toBe(false);
  });

  it("確かめた人数と今の人数が違えば始められない", () => {
    expect(
      checkCanStartRound({
        playerCount: 3,
        hasOpenRound: false,
        confirmedPlayerCount: 2,
      }).ok,
    ).toBe(false);
  });

  it("入力中のラウンドがあれば始められない", () => {
    expect(
      checkCanStartRound({
        playerCount: 3,
        hasOpenRound: true,
        confirmedPlayerCount: 3,
      }).ok,
    ).toBe(false);
  });
});
