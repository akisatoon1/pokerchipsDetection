import { computeChipPoints } from "../../rules/chip-points";
import { loadChipValues } from "../chip-values-store";
import type { Analysis } from "../detector";
import { element } from "../dom";
import { renderChipPoints } from "../result-views";
import { createChipAnalysisPanel } from "./chip-analysis";

/**
 * 数えるだけの画面を出す. マッチに入らずに, 撮影した, または選んだ写真のチップを数える.
 *
 * 色と点数を決めてあれば, 持ち点も出す. 検出の結果と速さを実機で確かめるためにも使うので, かかった時間も出す.
 * @param root 画面を入れる要素.
 */
export function renderCountPage(root: HTMLElement): void {
  const panel = createChipAnalysisPanel({
    renderHeader: renderPoints,
    renderFooter: renderTimings,
  });
  root.replaceChildren(
    element("h1", { text: "チップを数える" }),
    element("p", {
      text: "チップの山を撮影するか, 写真を選んでください.",
    }),
    panel.container,
    element("p", {}, [
      element("a", { text: "トップページへ", attributes: { href: "/" } }),
    ]),
  );
}

// 色と点数を決めてあれば持ち点を, なければ設定画面への案内を出す.
function renderPoints(analysis: Analysis): HTMLElement {
  const values = loadChipValues();
  if (values.size === 0) {
    return element("p", {}, [
      document.createTextNode("色と点数を決めると, 持ち点も出します. "),
      element("a", { text: "色と点数の設定", attributes: { href: "/chips" } }),
    ]);
  }
  return renderChipPoints(computeChipPoints(analysis.result, values));
}

// 実機で速さを確かめるための, 画像の大きさとかかった時間.
function renderTimings(analysis: Analysis): HTMLElement {
  const parts = [
    `画像 ${String(analysis.width)} × ${String(analysis.height)} px`,
    `読み込み ${formatSeconds(analysis.loadMilliseconds)} 秒`,
    `画像の変換 ${formatSeconds(analysis.decodeMilliseconds)} 秒`,
    `解析 ${formatSeconds(analysis.analyzeMilliseconds)} 秒`,
  ];
  return element("p", { className: "count-timings", text: parts.join(" / ") });
}

function formatSeconds(milliseconds: number): string {
  return (milliseconds / 1000).toFixed(2);
}
