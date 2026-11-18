import { CHIP_COLORS, chipValuesFromRecord } from "../../rules/chip-values";
import type { MatchView } from "../api";
import { element } from "../dom";
import { formatPoints } from "../result-views";

/**
 * マッチの色ごとの点数を出す. 全員に見せる.
 *
 * チップから入力するときに換算に使う点数を, 全員が確かめられるようにするため (docs/web/app.md).
 * @param match マッチ.
 * @returns section 要素.
 */
export function renderChipValuesSection(match: MatchView): HTMLElement {
  return element("section", {}, [
    element("h2", { text: "チップの点数" }),
    renderChipValuesList(match),
  ]);
}

// 決めた色だけを, 色の一覧の順に出す. 決めていなければ, その旨を出す.
function renderChipValuesList(match: MatchView): HTMLElement {
  const values = chipValuesFromRecord(match.chipValues);
  if (values.size === 0) {
    return element("p", {
      text: "まだ決まっていません. リーダーが決めると, チップから入力できます.",
    });
  }
  const rows = CHIP_COLORS.flatMap((color) => {
    const points = values.get(color.name);
    if (points === undefined) {
      return [];
    }
    const swatch = element("span", { className: "chip-swatch" });
    swatch.style.backgroundColor = color.swatch;
    return [
      element("li", { className: "chip-value-row" }, [
        swatch,
        element("span", { className: "chip-value-label", text: color.label }),
        element("span", { text: `${formatPoints(points)} 点` }),
      ]),
    ];
  });
  return element("ul", { className: "chip-values-list" }, rows);
}
