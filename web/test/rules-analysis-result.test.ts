import { describe, expect, it } from "vitest";
import { parseAnalysisResult } from "../src/rules/analysis-result";

// core の toJson の実際の出力 (CLI の --json. docs/logic/usage.md の例).
const COUNTED =
  '{"stacks":[{"box":[1089,1246,916,831],"score":0.969136,"count":10,"peaks":[6,92,174,258,340,420,501,582,667,745,821],"colors":["yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow"]}]}';

describe("core の解析の結果を読む", () => {
  it("toJson の出力を, 枠を x, y, 幅, 高さに分けて読む", () => {
    expect(parseAnalysisResult(COUNTED)).toEqual({
      ok: true,
      value: {
        stacks: [
          {
            x: 1089,
            y: 1246,
            width: 916,
            height: 831,
            score: 0.969136,
            count: 10,
            peaks: [6, 92, 174, 258, 340, 420, 501, 582, 667, 745, 821],
            colors: Array<string>(10).fill("yellow"),
          },
        ],
      },
    });
  });

  it("数えられなかったスタック (count が null, peaks と colors が空) も読む", () => {
    const json =
      '{"stacks":[{"box":[1,2,3,4],"score":0.5,"count":null,"peaks":[],"colors":[]}]}';
    expect(parseAnalysisResult(json)).toEqual({
      ok: true,
      value: {
        stacks: [
          {
            x: 1,
            y: 2,
            width: 3,
            height: 4,
            score: 0.5,
            count: null,
            peaks: [],
            colors: [],
          },
        ],
      },
    });
  });

  it("スタックが 1 つもない結果も読む", () => {
    expect(parseAnalysisResult('{"stacks":[]}')).toEqual({
      ok: true,
      value: { stacks: [] },
    });
  });

  it("JSON でなければ拒否する", () => {
    expect(parseAnalysisResult("{stacks").ok).toBe(false);
  });

  it("知らない項目があれば拒否する", () => {
    const json =
      '{"stacks":[{"box":[1,2,3,4],"score":0.5,"count":1,"peaks":[0,9],"colors":["red"],"extra":1}]}';
    expect(parseAnalysisResult(json).ok).toBe(false);
    expect(parseAnalysisResult('{"stacks":[],"version":2}').ok).toBe(false);
  });

  it("型の違う値があれば拒否する", () => {
    const wrongs = [
      '{"stacks":[{"box":[1,2,3],"score":0.5,"count":1,"peaks":[],"colors":[]}]}',
      '{"stacks":[{"box":[1,2,3,4.5],"score":0.5,"count":1,"peaks":[],"colors":[]}]}',
      '{"stacks":[{"box":[1,2,3,4],"score":"0.5","count":1,"peaks":[],"colors":[]}]}',
      '{"stacks":[{"box":[1,2,3,4],"score":0.5,"count":1.5,"peaks":[],"colors":[]}]}',
      '{"stacks":[{"box":[1,2,3,4],"score":0.5,"count":1,"peaks":[],"colors":[1]}]}',
      '{"stacks":[{"box":[1,2,3,4],"score":0.5,"peaks":[],"colors":[]}]}',
      '{"stacks":{}}',
    ];
    for (const json of wrongs) {
      expect(parseAnalysisResult(json).ok, json).toBe(false);
    }
  });
});
