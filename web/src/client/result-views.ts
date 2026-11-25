import type { AnalysisResult, StackResult } from "../rules/analysis-result";
import type { ChipPointsProblem, ChipPointsResult } from "../rules/chip-points";
import { findChipColor, type ChipColorName } from "../rules/chip-values";
import {
  applyColorCorrections,
  correctedColorAt,
  NO_CORRECTIONS,
  type ChipPosition,
  type ColorCorrections,
} from "../rules/color-corrections";
import { MAX_POINTS } from "../rules/limits";
import { createColorEditor, type ColorEditor } from "./color-editor";
import { element } from "./dom";

// 解析の結果の表示. Android の ResultViews.kt と ChipPointsViews.kt に当たり, 同じ見た目にそろえる.
// 大きさは CSS のピクセルで決め, canvas は端末の画素の細かさ (devicePixelRatio) で描く. 文字をぼかさないため.

/** 確認画像でスタックの枠の外に広げる量. 枠の幅・高さに対する割合. 枠そのもののずれにも気づけるようにするため. */
const DISPLAY_MARGIN = 0.2;

/** 確認画像の右に並べる色のラベルの列の幅 (CSS px). */
const LABEL_WIDTH = 110;

/** 確認画像の高さの上限 (CSS px). 縦長のスタックで画面を占めすぎないようにするため. */
const MAX_VIEW_HEIGHT = 560;

/** 合わせ目の線と枠の色. CLI のデバッグ画像の線と同じ. */
const SEAM_COLOR = "#ffa000";

const LABEL_BACKGROUND = "#1e1e1e";
/** 手で色を直したチップの, ラベルの列の帯の背景. 直していないチップと見分けるため. */
const CORRECTED_BACKGROUND = "#8a5a00";
const LABEL_TEXT = "#e6e6e6";
const FONT_FAMILY = "system-ui, sans-serif";

const NUMBER_FORMAT = new Intl.NumberFormat("ja-JP");

/**
 * 点数を, 3 桁ごとに区切って書く.
 *
 * @param points 点数.
 * @returns "1,500" のような文字.
 */
export function formatPoints(points: number): string {
  return NUMBER_FORMAT.format(points);
}

/**
 * 画像に, 検出したスタックの枠と「#n: m枚」を重ねて描く.
 *
 * @param image 解析した画像. 結果の座標はこの画像のピクセル.
 * @param result 解析の結果.
 * @param width 表示の幅 (CSS px).
 * @returns 描いた canvas. 描けなければその旨の文.
 */
export function renderResultImage(
  image: ImageBitmap,
  result: AnalysisResult,
  width: number,
): HTMLElement {
  const scale = width / image.width;
  const drawing = createDrawing(width, image.height * scale);
  if (drawing === null) {
    return renderCannotDraw();
  }
  const { canvas, context } = drawing;
  context.drawImage(image, 0, 0, width, image.height * scale);
  context.font = `bold 14px ${FONT_FAMILY}`;
  context.textBaseline = "top";
  result.stacks.forEach((stack, index) => {
    const left = stack.x * scale;
    const top = stack.y * scale;
    context.strokeStyle = SEAM_COLOR;
    context.lineWidth = 3;
    context.strokeRect(left, top, stack.width * scale, stack.height * scale);
    const label = `#${String(index + 1)}: ${stack.count === null ? "?" : String(stack.count)}枚`;
    const labelWidth = context.measureText(label).width + 8;
    const labelTop = Math.max(0, top - 22);
    context.fillStyle = "rgb(0 0 0 / 80%)";
    context.fillRect(left, labelTop, labelWidth, 20);
    context.fillStyle = "#fff";
    context.fillText(label, left + 4, labelTop + 3);
  });
  return canvas;
}

/** 合計の枚数と, スタックごとの確認画像と「色を直す」の欄. */
export interface ResultSummary {
  container: HTMLElement;
  /**
   * 直した色を, 確認画像のラベルと「色を直す」の欄に映す. 色を直したあとに呼ぶ.
   *
   * 画像は描き直さない. 描き終えた画像は手放すので, 色のラベルの列だけを描き直す.
   * @param corrections その写真の直した色.
   */
  update(corrections: ColorCorrections): void;
}

/**
 * 合計の枚数と, スタックごとの確認画像を出す. 確認画像の下に「色を直す」の欄を置く.
 *
 * @param image 解析した画像. 描き終えたら呼んだ側が手放してよい.
 * @param detected 解析の結果 (直す前).
 * @param width 表示の幅 (CSS px).
 * @param onColorChange 色を直した, または元に戻した (color が null) とき.
 * @returns 表示. 初めは直したチップのない表示. スタックがなければ, 見つからなかったという文.
 */
export function renderResultSummary(
  image: ImageBitmap,
  detected: AnalysisResult,
  width: number,
  onColorChange: (position: ChipPosition, color: ChipColorName | null) => void,
): ResultSummary {
  if (detected.stacks.length === 0) {
    return {
      container: element("p", { text: "チップの山が見つかりませんでした." }),
      update: () => undefined,
    };
  }
  const total = detected.stacks.reduce(
    (sum, stack) => sum + (stack.count ?? 0),
    0,
  );
  const checks = detected.stacks.map((stack, index) =>
    renderStackCheck(image, stack, { index, width, onColorChange }),
  );
  return {
    container: element("div", { className: "result-summary" }, [
      element("p", {
        className: "result-total",
        text: `合計: ${String(total)}枚`,
      }),
      ...checks.map((check) => check.container),
    ]),
    update: (corrections) => {
      const corrected = applyColorCorrections(detected, corrections);
      checks.forEach((check, index) => {
        check.update(corrected.stacks[index]?.colors ?? [], corrections);
      });
    },
  };
}

/**
 * チップから求めた持ち点を出す. 求められれば色ごとの内訳と合計, 求められなければ理由.
 *
 * @param points 持ち点を求めた結果.
 * @returns 表示.
 */
export function renderChipPoints(points: ChipPointsResult): HTMLElement {
  if (!points.ok) {
    return element("div", { className: "chip-points" }, [
      element("p", { className: "error", text: "持ち点を求められません" }),
      element(
        "ul",
        { className: "error" },
        points.problems.map((problem) =>
          element("li", { text: describeProblem(problem) }),
        ),
      ),
      element("p", {
        text: "色を直すか, その写真を外して撮り直すか, 手で入力してください.",
      }),
    ]);
  }
  const rows = points.subtotals.map((item) =>
    element("tr", {}, [
      element("td", {
        text: `${item.color.label} × ${String(item.count)} × ${NUMBER_FORMAT.format(item.pointsEach)}`,
      }),
      element("td", { text: `= ${NUMBER_FORMAT.format(item.subtotal)}` }),
    ]),
  );
  rows.push(
    element("tr", { className: "chip-points-total" }, [
      element("th", { text: "合計" }),
      element("td", { text: NUMBER_FORMAT.format(points.total) }),
    ]),
  );
  return element("table", { className: "chip-points" }, [
    element("tbody", {}, rows),
  ]);
}

// 求められない理由を, どの写真のどのスタックの何枚目かが分かる文にする.
// 番号は写真ごとの表示の「写真 n」と, 確認画像の「スタック #n」と同じ.
function describeProblem(problem: ChipPointsProblem): string {
  switch (problem.kind) {
    case "noPhoto":
      return "写真がありません.";
    case "noStack":
      return `写真 ${String(problem.photoNumber)} にチップの山が見つかりませんでした.`;
    case "countFailed":
      return `${describeStack(problem)} の枚数を数えられませんでした.`;
    case "unknownColor":
      return `${describeStack(problem)} の上から ${String(problem.chipNumber)} 枚目の色が分かりません. 「色を直す」で直せます.`;
    case "unsetColor":
      return `${describeStack(problem)} の上から ${String(problem.chipNumber)} 枚目は「${problem.color.label}」ですが, この色の点数を決めていません. 色が違えば「色を直す」で直せます.`;
    case "tooLarge":
      return `合計 ${NUMBER_FORMAT.format(problem.total)} が, 持ち点の上限 ${NUMBER_FORMAT.format(MAX_POINTS)} を超えています.`;
  }
}

// 「写真 2 のスタック #1」.
function describeStack(position: {
  photoNumber: number;
  stackNumber: number;
}): string {
  return `写真 ${String(position.photoNumber)} のスタック #${String(position.stackNumber)}`;
}

/** 確認画像に切り出す範囲 (元画像のピクセル). */
interface ViewArea {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 確認画像を作るときに使うもの. */
interface StackCheckOptions {
  /** スタックの番号 (左から, 0 から). */
  index: number;
  /** 表示の幅 (CSS px). */
  width: number;
  /** 色を直した, または元に戻した (color が null) とき. */
  onColorChange: (position: ChipPosition, color: ChipColorName | null) => void;
}

/** スタック 1 つの確認画像と「色を直す」の欄. */
interface StackCheck {
  container: HTMLElement;
  /** 直したあとの色 (上のチップから順) と直した色を, 表示に映す. */
  update(colors: readonly string[], corrections: ColorCorrections): void;
}

// スタック 1 つの枚数と色を, 画像と見比べて確かめるための表示.
// 枠を広げて切り出し, 合わせ目に横線を引き, 右にチップごとの色を並べる (CLI のデバッグ画像から輝度のグラフを除いたもの).
// その下に「色を直す」の欄を置き, 確認画像のチップ (帯) を押すと, そのチップの行に移る.
function renderStackCheck(
  image: ImageBitmap,
  stack: StackResult,
  options: StackCheckOptions,
): StackCheck {
  const heading = `スタック #${String(options.index + 1)}: ${stack.count === null ? "数えられませんでした" : `${String(stack.count)}枚`}`;
  const colorsLine = element("p");
  const container = element("div", { className: "stack-check" }, [
    element("h3", { text: heading }),
    colorsLine,
  ]);
  const { view, labels } = drawStackImage(image, stack, options.width);
  if (view !== null) {
    container.append(view);
  }
  const editor = renderColorEditor(stack, options, labels);
  if (editor !== null) {
    container.append(editor.container);
  }
  const update = (
    colors: readonly string[],
    corrections: ColorCorrections,
  ): void => {
    colorsLine.hidden = colors.length === 0;
    colorsLine.textContent = `色: ${describeColors(colors)}`;
    labels?.draw(
      colors,
      colors.map(
        (_, chipIndex) =>
          correctedColorAt(corrections, {
            stackIndex: options.index,
            chipIndex,
          }) !== null,
      ),
    );
    editor?.update(corrections);
  };
  update(stack.colors, NO_CORRECTIONS);
  return { container, update };
}

// 「色を直す」の欄を作り, 確認画像のチップ (帯) を押したらその行に移るようにする. 色のあるチップがなければ null.
function renderColorEditor(
  stack: StackResult,
  options: StackCheckOptions,
  labels: LabelColumn | null,
): ColorEditor | null {
  if (stack.colors.length === 0) {
    return null;
  }
  const editor = createColorEditor({
    stackIndex: options.index,
    detectedColors: stack.colors,
    onChange: options.onColorChange,
  });
  labels?.enableChipSelection((chipIndex) => {
    editor.focusChip(chipIndex);
  });
  return editor;
}

// 色ごとの枚数. 多い色から並べる.
function describeColors(colors: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of colors) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${colorLabel(name)} ×${String(count)}`)
    .join(", ");
}

/** 確認画像の canvas の, 色のラベルの列. */
interface LabelColumn {
  /**
   * 列を描き直す. 直したチップは帯の背景を変え, 名前の前に「✎」を付ける.
   *
   * @param colors 直したあとの色. 上のチップから順.
   * @param isCorrected チップごとに, 手で直したか.
   */
  draw(colors: readonly string[], isCorrected: readonly boolean[]): void;
  /** 確認画像のチップ (帯) を押したら, 上から何枚目か (0 から) を伝えるようにする. */
  enableChipSelection(onSelect: (chipIndex: number) => void): void;
}

/** 確認画像. view は表示 (canvas か, 描けなかったという文. 切り出す範囲がなければ null). */
interface StackImage {
  view: HTMLElement | null;
  labels: LabelColumn | null;
}

// 確認画像を描く. 切り出した画像, 枠, 合わせ目の線は 1 回だけ描き, 色のラベルの列はあとから描き直せるようにする.
// 画像は描き終えたら手放すので, 色を直したときに画像まで描き直すことはできないため.
function drawStackImage(
  image: ImageBitmap,
  stack: StackResult,
  width: number,
): StackImage {
  const area = viewArea(image, stack);
  if (area.width <= 0 || area.height <= 0) {
    return { view: null, labels: null };
  }
  const imageHeight = Math.min(
    ((width - LABEL_WIDTH) * area.height) / area.width,
    MAX_VIEW_HEIGHT,
  );
  const scale = imageHeight / area.height;
  const imageWidth = area.width * scale;
  const drawing = createDrawing(imageWidth + LABEL_WIDTH, imageHeight);
  if (drawing === null) {
    return { view: renderCannotDraw(), labels: null };
  }
  const { canvas, context } = drawing;
  context.drawImage(
    image,
    area.left,
    area.top,
    area.width,
    area.height,
    0,
    0,
    imageWidth,
    imageHeight,
  );
  const layout = {
    roiLeft: (stack.x - area.left) * scale,
    roiTop: (stack.y - area.top) * scale,
    scale,
    labelLeft: imageWidth,
    height: imageHeight,
  };
  const seamYs = drawRoiAndSeams(context, stack, layout);
  return {
    view: canvas,
    labels: createLabelColumn(canvas, context, seamYs, layout),
  };
}

// スタックの枠を広げた範囲を, 画像の中に収める.
function viewArea(image: ImageBitmap, stack: StackResult): ViewArea {
  const marginX = Math.round(stack.width * DISPLAY_MARGIN);
  const marginY = Math.round(stack.height * DISPLAY_MARGIN);
  const left = Math.max(0, stack.x - marginX);
  const top = Math.max(0, stack.y - marginY);
  const right = Math.min(image.width, stack.x + stack.width + marginX);
  const bottom = Math.min(image.height, stack.y + stack.height + marginY);
  return { left, top, width: right - left, height: bottom - top };
}

/** 確認画像の中の, 枠とラベルの列の位置 (CSS px). */
interface StackLayout {
  roiLeft: number;
  roiTop: number;
  /** 元画像のピクセルから CSS px への倍率. */
  scale: number;
  labelLeft: number;
  height: number;
}

// 画像の上に, 枠 (破線) と合わせ目の線を描く. 合わせ目の y (CSS px) を返す.
function drawRoiAndSeams(
  context: CanvasRenderingContext2D,
  stack: StackResult,
  layout: StackLayout,
): number[] {
  const { roiLeft, roiTop, scale } = layout;
  const roiWidth = stack.width * scale;
  context.strokeStyle = SEAM_COLOR;
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  context.strokeRect(roiLeft, roiTop, roiWidth, stack.height * scale);
  context.setLineDash([]);

  const seamYs = stack.peaks.map((peak) => roiTop + peak * scale);
  context.lineWidth = 1.5;
  for (const y of seamYs) {
    drawLine(context, roiLeft, roiLeft + roiWidth, y);
  }
  return seamYs;
}

function createLabelColumn(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  seamYs: readonly number[],
  layout: StackLayout,
): LabelColumn {
  return {
    draw: (colors, isCorrected) => {
      drawLabelColumn(context, { seamYs, layout, colors, isCorrected });
    },
    enableChipSelection: (onSelect) => {
      canvas.classList.add("selectable");
      canvas.addEventListener("click", (event) => {
        // canvas は画面の幅に合わせて縮むので, 押した位置を描いたときの大きさ (CSS px) に直す.
        if (canvas.clientHeight === 0) {
          return;
        }
        const y = (event.offsetY * layout.height) / canvas.clientHeight;
        const chipIndex = seamYs.findIndex((upper, index) => {
          const lower = seamYs[index + 1];
          return lower !== undefined && y >= upper && y < lower;
        });
        if (chipIndex >= 0) {
          onSelect(chipIndex);
        }
      });
    },
  };
}

/** 色のラベルの列を描くのに使うもの. */
interface LabelColumnContent {
  seamYs: readonly number[];
  layout: StackLayout;
  colors: readonly string[];
  isCorrected: readonly boolean[];
}

// 右の列に, チップごとの色の見本と名前を描く. 直したチップは帯の背景を変え, 名前の前に「✎」を付ける.
function drawLabelColumn(
  context: CanvasRenderingContext2D,
  content: LabelColumnContent,
): void {
  const { seamYs, layout, colors, isCorrected } = content;
  const { labelLeft, height } = layout;
  context.fillStyle = LABEL_BACKGROUND;
  context.fillRect(labelLeft, 0, LABEL_WIDTH, height);
  colors.forEach((_, chip) => {
    const upper = seamYs[chip];
    const lower = seamYs[chip + 1];
    if (
      isCorrected[chip] === true &&
      upper !== undefined &&
      lower !== undefined
    ) {
      context.fillStyle = CORRECTED_BACKGROUND;
      context.fillRect(labelLeft, upper, LABEL_WIDTH, lower - upper);
    }
  });
  context.lineWidth = 1.5;
  for (const y of seamYs) {
    drawLine(context, labelLeft, labelLeft + LABEL_WIDTH, y);
  }

  context.textBaseline = "middle";
  colors.forEach((name, chip) => {
    const upper = seamYs[chip];
    const lower = seamYs[chip + 1];
    if (upper === undefined || lower === undefined) {
      return;
    }
    const label = `${isCorrected[chip] === true ? "✎ " : ""}${colorLabel(name)}`;
    drawChipLabel(context, { name, label, upper, lower, left: labelLeft });
  });
}

/** ラベルの列の, チップ 1 枚の帯. 位置は CSS px. */
interface ChipLabel {
  /** core の色の名前. 見本の色に使う. */
  name: string;
  /** 帯に書く文字. */
  label: string;
  upper: number;
  lower: number;
  /** 列の左端. */
  left: number;
}

// チップ 1 枚の色の見本と名前を, 帯の縦の真ん中に描く.
// チップが多いと帯が狭くなるので, 文字と見本の大きさを帯の高さに合わせる.
function drawChipLabel(
  context: CanvasRenderingContext2D,
  chip: ChipLabel,
): void {
  const band = chip.lower - chip.upper;
  const centerY = (chip.upper + chip.lower) / 2;
  const swatch = Math.min(12, band * 0.8);
  const swatchLeft = chip.left + 6;
  context.fillStyle = findChipColor(chip.name)?.swatch ?? "#fff";
  context.fillRect(swatchLeft, centerY - swatch / 2, swatch, swatch);
  // 黒のチップの見本が背景に埋もれないよう枠を付ける.
  context.strokeStyle = "#ccc";
  context.lineWidth = 1;
  context.strokeRect(swatchLeft, centerY - swatch / 2, swatch, swatch);
  context.fillStyle = LABEL_TEXT;
  context.font = `${String(Math.min(band * 0.7, 14))}px ${FONT_FAMILY}`;
  context.fillText(chip.label, swatchLeft + swatch + 6, centerY);
}

function drawLine(
  context: CanvasRenderingContext2D,
  fromX: number,
  toX: number,
  y: number,
): void {
  context.strokeStyle = SEAM_COLOR;
  context.beginPath();
  context.moveTo(fromX, y);
  context.lineTo(toX, y);
  context.stroke();
}

// 画面に出す色の名前. 7 色にない名前 (unknown) は「不明」.
function colorLabel(name: string): string {
  return findChipColor(name)?.label ?? "不明";
}

interface Drawing {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

// 表示の大きさ (CSS px) の canvas を, 端末の画素の細かさで作る. 描くときの座標は CSS px のまま.
function createDrawing(width: number, height: number): Drawing | null {
  const ratio = window.devicePixelRatio;
  const canvas = element("canvas", { className: "result-canvas" });
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  // 高さは CSS で auto にし, 縦横比を保つ. 画面が狭くなって幅が縮んでも, 縦に伸びないようにするため.
  canvas.style.width = `${String(width)}px`;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }
  context.scale(ratio, ratio);
  return { canvas, context };
}

function renderCannotDraw(): HTMLElement {
  return element("p", {
    className: "error",
    text: "画像を表示できませんでした.",
  });
}
