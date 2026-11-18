import type { Analysis } from "../detector";
import { element } from "../dom";
import { createChipAnalysisPanel } from "./chip-analysis";

/**
 * 数えるだけの画面を出す. マッチに入らずに, 撮影した, または選んだ写真のチップを数える.
 *
 * 持ち点は出さない. 色ごとの点数はマッチが持つので, マッチに入らないこの画面には点数がないため (docs/web/app.md).
 * 検出の結果と速さを実機で確かめるためにも使うので, かかった時間も出す.
 * @param root 画面を入れる要素.
 */
export function renderCountPage(root: HTMLElement): void {
  const panel = createChipAnalysisPanel({
    renderHeader: renderNoPointsNote,
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

// 持ち点を出さない理由と, 持ち点を出せる場所の案内.
function renderNoPointsNote(): HTMLElement {
  return element("p", {
    className: "note",
    text: "持ち点は, マッチの画面の「チップから入力」で, マッチのチップの点数から出します.",
  });
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
