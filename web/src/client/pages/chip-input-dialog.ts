import { computeChipPoints } from "../../rules/chip-points";
import type { ChipValues } from "../../rules/chip-values";
import type { Analysis } from "../detector";
import { element } from "../dom";
import { renderChipPoints } from "../result-views";
import { createChipAnalysisPanel } from "./chip-analysis";

/**
 * ブラウザの検出画面を, マッチの画面の上に重ねて開く. チップから持ち点を求め, 入力欄に入れさせる.
 *
 * 求めた持ち点は「この点数を入れる」を押したときだけ返す. 閉じたら何も返さない (docs/web/app.md).
 * マッチの画面はそのまま残るので, 入力中の欄と画面の位置は変わらない.
 * 点数はこの画面の中では変えられない. 変えるのはリーダーがマッチの画面で行う.
 * @param values マッチの色ごとの点数. 開く直前に読み直した最新のもの.
 * @param onPoints 持ち点を受ける. 範囲の確かめは, 欄に入れたあとの送信でサーバーが行う.
 */
export function openChipInputDialog(
  values: ChipValues,
  onPoints: (points: number) => void,
): void {
  const closeButton = element("button", {
    text: "閉じる",
    attributes: { type: "button" },
  });
  const dialog = element("dialog", { className: "chip-input-dialog" }, [
    element("div", { className: "chip-input-dialog-header" }, [
      element("h3", { text: "チップから入力" }),
      closeButton,
    ]),
    element("p", { text: "チップの山を撮影するか, 写真を選んでください." }),
  ]);

  const panel = createChipAnalysisPanel({
    renderHeader: (analysis) =>
      renderPointsAndInsert(analysis, values, (points) => {
        onPoints(points);
        dialog.close();
      }),
  });
  dialog.append(panel.container);

  closeButton.addEventListener("click", () => {
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    panel.dispose();
    dialog.remove();
  });
  document.body.append(dialog);
  dialog.showModal();
}

// 持ち点と, 「この点数を入れる」のボタン.
// 求められないときは「この点数を入れる」を押せなくする. 黙って 0 点などを入れないため.
function renderPointsAndInsert(
  analysis: Analysis,
  values: ChipValues,
  onInsert: (points: number) => void,
): HTMLElement {
  const points = computeChipPoints(analysis.result, values);
  const insert = element("button", {
    text: "この点数を入れる",
    attributes: { type: "button" },
  });
  insert.disabled = !points.ok;
  if (points.ok) {
    const { total } = points;
    insert.addEventListener("click", () => {
      onInsert(total);
    });
  }
  return element("div", {}, [
    renderChipPoints(points),
    element("div", { className: "chip-input-actions" }, [insert]),
  ]);
}
