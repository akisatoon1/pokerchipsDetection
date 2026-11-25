import { computeChipPoints } from "../../rules/chip-points";
import type { AnalysisResult } from "../../rules/analysis-result";
import type { ChipValues } from "../../rules/chip-values";
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
    renderHeader: (photos, correctedChipCount) =>
      renderPointsAndInsert({
        photos,
        correctedChipCount,
        values,
        onInsert: (points) => {
          onPoints(points);
          dialog.close();
        },
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

/** 持ち点の表示を作るときに使うもの. */
interface PointsHeaderContent {
  /** すべての写真の, 手で直した色を当てた結果. */
  photos: AnalysisResult[];
  /** 手で色を直したチップの枚数. */
  correctedChipCount: number;
  values: ChipValues;
  onInsert: (points: number) => void;
}

// すべての写真から求めた持ち点と, 「この点数を入れる」のボタン.
// 求められないときは「この点数を入れる」を押せなくする. 黙って 0 点などを入れないため.
// 色を直したチップがあれば, その枚数を出す. 検出のままの持ち点と区別できるようにするため.
function renderPointsAndInsert(content: PointsHeaderContent): HTMLElement {
  const { photos, correctedChipCount, values, onInsert } = content;
  const points = computeChipPoints(photos, values);
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
  const header = element("div", {}, [renderChipPoints(points)]);
  if (correctedChipCount > 0) {
    header.append(
      element("p", {
        className: "note corrected-note",
        text: `手で直した色 ${String(correctedChipCount)} 枚を含みます.`,
      }),
    );
  }
  header.append(element("div", { className: "chip-input-actions" }, [insert]));
  return header;
}
