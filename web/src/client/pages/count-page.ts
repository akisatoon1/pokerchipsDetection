import type { StackResult } from "../../rules/analysis-result";
import { analyzeImage, type Analysis } from "../detector";
import { element } from "../dom";

/**
 * 数えるだけの画面を出す. マッチに入らずに, 撮影した, または選んだ写真のチップを数える.
 *
 * 検出の結果と速さを実機で確かめるためにも使う. そのため, かかった時間も出す.
 * @param root 画面を入れる要素.
 */
export function renderCountPage(root: HTMLElement): void {
  const status = element("p", { attributes: { role: "status" } });
  const output = element("div");
  const pickers = renderImagePickers((file, buttons) => {
    void showAnalysis(file, { status, output, buttons });
  });
  root.replaceChildren(
    element("h1", { text: "チップを数える" }),
    element("p", {
      text: "チップの山を撮影するか, 写真を選んでください.",
    }),
    pickers,
    status,
    output,
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
}

// 撮影と写真の選択の 2 つのボタン. ファイルの欄は隠し, ボタンから開く.
function renderImagePickers(
  onPicked: (file: File, buttons: HTMLButtonElement[]) => void,
): HTMLElement {
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
        onPicked(file, buttons);
      }
    });
    buttons.push(button);
    container.append(button, input);
  }
  return container;
}

async function showAnalysis(file: File, view: AnalysisView): Promise<void> {
  setButtonsDisabled(view.buttons, true);
  view.output.replaceChildren();
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
  view.output.replaceChildren(
    renderStacks(analysis.value.result.stacks),
    renderTimings(analysis.value),
  );
}

function setButtonsDisabled(
  buttons: HTMLButtonElement[],
  isDisabled: boolean,
): void {
  for (const button of buttons) {
    button.disabled = isDisabled;
  }
}

// スタックごとの枚数と色. 番号は左から 1, 2, … (Android の確認画像の「スタック #n」と同じ).
function renderStacks(stacks: StackResult[]): HTMLElement {
  if (stacks.length === 0) {
    return element("p", { text: "チップの山が見つかりませんでした." });
  }
  const list = element("ul", { className: "count-stacks" });
  stacks.forEach((stack, index) => {
    const name = `スタック #${String(index + 1)}`;
    const text =
      stack.count === null
        ? `${name}: 枚数を数えられませんでした.`
        : `${name}: ${String(stack.count)} 枚 (上から ${stack.colors.join(", ")})`;
    list.append(element("li", { text }));
  });
  return list;
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
