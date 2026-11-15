import { computeChipPoints } from "../../rules/chip-points";
import { loadChipValues } from "../chip-values-store";
import { analyzeImage, type Analysis } from "../detector";
import { element } from "../dom";
import {
  renderChipPoints,
  renderResultImage,
  renderResultSummary,
} from "../result-views";

/** 表示の幅が測れないとき (画面に入る前など) に使う幅 (CSS px). */
const FALLBACK_WIDTH = 320;

/**
 * 数えるだけの画面を出す. マッチに入らずに, 撮影した, または選んだ写真のチップを数える.
 *
 * 色と点数を決めてあれば, 持ち点も出す. 検出の結果と速さを実機で確かめるためにも使うので, かかった時間も出す.
 * @param root 画面を入れる要素.
 */
export function renderCountPage(root: HTMLElement): void {
  const pickers = renderImagePickers((file) => {
    void showAnalysis(file, view);
  });
  const view: AnalysisView = {
    status: element("p", { attributes: { role: "status" } }),
    output: element("div"),
    buttons: pickers.buttons,
    shownImage: null,
  };
  root.replaceChildren(
    element("h1", { text: "チップを数える" }),
    element("p", {
      text: "チップの山を撮影するか, 写真を選んでください.",
    }),
    pickers.container,
    view.status,
    view.output,
    element("p", {}, [
      element("a", { text: "トップページへ", attributes: { href: "/" } }),
    ]),
  );
}

/** 解析の様子と結果を出す場所. */
interface AnalysisView {
  status: HTMLElement;
  output: HTMLElement;
  /** 解析の間は押せなくするボタン. */
  buttons: HTMLButtonElement[];
  /** いま出している画像. 次の解析で表示を替えるときに close する. */
  shownImage: ImageBitmap | null;
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

async function showAnalysis(file: File, view: AnalysisView): Promise<void> {
  setButtonsDisabled(view.buttons, true);
  view.output.replaceChildren();
  // 前の画像は大きい (12MP で約 48MB) ので, 表示から外したらすぐ手放す.
  view.shownImage?.close();
  view.shownImage = null;
  view.status.className = "";
  view.status.textContent =
    "解析中… (初めては検出の仕組みの読み込みに時間がかかります)";
  const analysis = await analyzeImage(file);
  setButtonsDisabled(view.buttons, false);
  if (!analysis.ok) {
    view.status.className = "error";
    view.status.textContent = analysis.reason;
    return;
  }
  view.status.textContent = "";
  view.shownImage = analysis.value.image;
  view.output.replaceChildren(renderPoints(analysis.value));
  const width = view.output.clientWidth || FALLBACK_WIDTH;
  const { image, result } = analysis.value;
  view.output.append(
    renderResultImage(image, result, width),
    renderResultSummary(image, result, width),
    renderTimings(analysis.value),
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

function setButtonsDisabled(
  buttons: HTMLButtonElement[],
  isDisabled: boolean,
): void {
  for (const button of buttons) {
    button.disabled = isDisabled;
  }
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
