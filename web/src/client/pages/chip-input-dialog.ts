import { computeChipPoints } from "../../rules/chip-points";
import { loadChipValues } from "../chip-values-store";
import type { Analysis } from "../detector";
import { element } from "../dom";
import { renderChipPoints } from "../result-views";
import { createChipAnalysisPanel } from "./chip-analysis";
import { renderChipValuesForm } from "./chip-values-page";

/**
 * ブラウザの検出画面を, マッチの画面の上に重ねて開く. チップから持ち点を求め, 入力欄に入れさせる.
 *
 * 色と点数をまだ決めていなければ, 先に設定を出す. 求めた持ち点は「この点数を入れる」を押したときだけ返す.
 * 閉じたら何も返さない (docs/web/app.md). マッチの画面はそのまま残るので, 入力中の欄と画面の位置は変わらない.
 * @param onPoints 持ち点を受ける. 範囲の確かめは, 欄に入れたあとの送信でサーバーが行う.
 */
export function openChipInputDialog(onPoints: (points: number) => void): void {
  const body = element("div");
  const closeButton = element("button", {
    text: "閉じる",
    attributes: { type: "button" },
  });
  const dialog = element("dialog", { className: "chip-input-dialog" }, [
    element("div", { className: "chip-input-dialog-header" }, [
      element("h3", { text: "チップから入力" }),
      closeButton,
    ]),
    body,
  ]);

  const panel = createChipAnalysisPanel({
    renderHeader: (analysis) =>
      renderPointsAndActions(analysis, {
        onInsert: (points) => {
          onPoints(points);
          dialog.close();
        },
        onEditValues: showValues,
      }),
  });
  const detection = element("div", {}, [
    element("p", { text: "チップの山を撮影するか, 写真を選んでください." }),
    panel.container,
  ]);
  function showDetection(): void {
    body.replaceChildren(detection);
    panel.refresh();
  }
  // 設定を変えたら, 今の解析の結果から持ち点を求め直す.
  function showValues(): void {
    const form = renderChipValuesForm(showDetection);
    const cancel = element("button", {
      text: "やめる",
      attributes: { type: "button" },
    });
    cancel.addEventListener("click", showDetection);
    body.replaceChildren(element("h4", { text: "色と点数の設定" }), form);
    // 初めての設定のときは戻る先に意味がないので, やめるは出さない.
    if (loadChipValues().size > 0) {
      body.append(cancel);
    }
  }

  closeButton.addEventListener("click", () => {
    dialog.close();
  });
  dialog.addEventListener("close", () => {
    panel.dispose();
    dialog.remove();
  });
  if (loadChipValues().size === 0) {
    showValues();
  } else {
    showDetection();
  }
  document.body.append(dialog);
  dialog.showModal();
}

/** 持ち点の下に出すボタンの動き. */
interface PointsActions {
  /** 「この点数を入れる」を押したとき. */
  onInsert(points: number): void;
  /** 「色と点数の設定を変える」を押したとき. */
  onEditValues(): void;
}

// 持ち点と, 「この点数を入れる」「色と点数の設定を変える」のボタン.
// 求められないときは「この点数を入れる」を押せなくする. 黙って 0 点などを入れないため.
function renderPointsAndActions(
  analysis: Analysis,
  actions: PointsActions,
): HTMLElement {
  const points = computeChipPoints(analysis.result, loadChipValues());
  const insert = element("button", {
    text: "この点数を入れる",
    attributes: { type: "button" },
  });
  insert.disabled = !points.ok;
  if (points.ok) {
    const { total } = points;
    insert.addEventListener("click", () => {
      actions.onInsert(total);
    });
  }
  const editValues = element("button", {
    text: "色と点数の設定を変える",
    attributes: { type: "button" },
  });
  editValues.addEventListener("click", () => {
    actions.onEditValues();
  });
  return element("div", {}, [
    renderChipPoints(points),
    element("div", { className: "chip-input-actions" }, [insert, editValues]),
  ]);
}
