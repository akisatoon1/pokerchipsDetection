import { analyzeImage, type Analysis } from "../detector";
import { element } from "../dom";
import { renderResultImage, renderResultSummary } from "../result-views";

/** 表示の幅が測れないとき (画面に入る前など) に使う幅 (CSS px). */
const FALLBACK_WIDTH = 320;

/** 撮影 / 写真の選択 → 解析 → 結果の表示をまとめた部品. 数えるだけの画面と検出画面で使う. */
export interface ChipAnalysisPanel {
  /** ボタン, 解析の様子, 結果を入れた要素. */
  container: HTMLElement;
  /** 出している画像を手放す. 部品を画面から外すときに呼ぶ. */
  dispose(): void;
}

/** 部品の, 使う画面ごとに違うところ. */
export interface ChipAnalysisOptions {
  /** 結果の上に出すもの (持ち点など). 結果を出すたびに呼ぶ. */
  renderHeader(analysis: Analysis): HTMLElement;
  /** 結果の下に出すもの (かかった時間など). なければ何も出さない. */
  renderFooter?(analysis: Analysis): HTMLElement;
}

/**
 * 撮影するか写真を選び, チップを解析して結果を出す部品を作る.
 *
 * 結果は, 上に options.renderHeader, 次に枠と枚数を重ねた全体画像, スタックごとの確認画像, 下に options.renderFooter.
 * @param options 使う画面ごとに違うところ.
 * @returns 部品.
 */
export function createChipAnalysisPanel(
  options: ChipAnalysisOptions,
): ChipAnalysisPanel {
  const status = element("p", { attributes: { role: "status" } });
  const output = element("div");
  let shown: Analysis | null = null;

  const release = (): void => {
    // 画像は大きい (12MP で約 48MB) ので, 表示から外したらすぐ手放す.
    shown?.image.close();
    shown = null;
    output.replaceChildren();
  };
  const render = (analysis: Analysis): void => {
    output.replaceChildren(options.renderHeader(analysis));
    const width = output.clientWidth || FALLBACK_WIDTH;
    output.append(
      renderResultImage(analysis.image, analysis.result, width),
      renderResultSummary(analysis.image, analysis.result, width),
    );
    if (options.renderFooter !== undefined) {
      output.append(options.renderFooter(analysis));
    }
  };
  const pickers = renderImagePickers((file) => {
    release();
    setButtonsDisabled(pickers.buttons, true);
    status.className = "";
    status.textContent =
      "解析中… (初めては検出の仕組みの読み込みに時間がかかります)";
    void analyzeImage(file).then((analysis) => {
      setButtonsDisabled(pickers.buttons, false);
      if (!analysis.ok) {
        status.className = "error";
        status.textContent = analysis.reason;
        return;
      }
      status.textContent = "";
      shown = analysis.value;
      render(analysis.value);
    });
  });
  return {
    container: element("div", { className: "chip-analysis" }, [
      pickers.container,
      status,
      output,
    ]),
    dispose: release,
  };
}

/** 撮影と写真の選択のボタン. */
interface ImagePickers {
  container: HTMLElement;
  buttons: HTMLButtonElement[];
}

// 撮影と写真の選択の 2 つのボタン. ファイルの欄は隠し, ボタンから開く.
function renderImagePickers(onPicked: (file: File) => void): ImagePickers {
  const buttons: HTMLButtonElement[] = [];
  const container = element("div", { className: "image-pickers" });
  // capture を付けるとカメラが開き, 付けないと写真の一覧から選べる.
  for (const { label, capture } of [
    { label: "撮影する", capture: true },
    { label: "写真を選ぶ", capture: false },
  ]) {
    const input = element("input", {
      attributes: { type: "file", accept: "image/*", hidden: "" },
    });
    if (capture) {
      input.setAttribute("capture", "environment");
    }
    const button = element("button", {
      text: label,
      attributes: { type: "button" },
    });
    button.addEventListener("click", () => {
      input.click();
    });
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      // 同じ写真をもう一度選んでも change が起きるよう, 欄を空に戻す.
      input.value = "";
      if (file !== undefined) {
        onPicked(file);
      }
    });
    buttons.push(button);
    container.append(button, input);
  }
  return { container, buttons };
}

function setButtonsDisabled(
  buttons: HTMLButtonElement[],
  isDisabled: boolean,
): void {
  for (const button of buttons) {
    button.disabled = isDisabled;
  }
}
