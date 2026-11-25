import type { AnalysisResult, StackResult } from "../rules/analysis-result";
import type { ChipPointsProblem, ChipPointsResult } from "../rules/chip-points";
import { findChipColor } from "../rules/chip-values";
import { MAX_POINTS } from "../rules/limits";
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

/**
 * 合計の枚数と, スタックごとの確認画像を出す.
 *
 * @param image 解析した画像.
 * @param result 解析の結果.
 * @param width 表示の幅 (CSS px).
 * @returns 表示. スタックがなければ, 見つからなかったという文.
 */
export function renderResultSummary(
  image: ImageBitmap,
  result: AnalysisResult,
  width: number,
): HTMLElement {
  if (result.stacks.length === 0) {
    return element("p", { text: "チップの山が見つかりませんでした." });
  }
  const total = result.stacks.reduce(
    (sum, stack) => sum + (stack.count ?? 0),
    0,
  );
  return element("div", { className: "result-summary" }, [
    element("p", {
      className: "result-total",
      text: `合計: ${String(total)}枚`,
    }),
    ...result.stacks.map((stack, index) =>
      renderStackCheck(image, stack, index, width),
    ),
  ]);
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
        text: "その写真を外して撮り直すか, 手で入力してください.",
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
      return `${describeStack(problem)} の上から ${String(problem.chipNumber)} 枚目の色が分かりません.`;
    case "unsetColor":
      return `${describeStack(problem)} の上から ${String(problem.chipNumber)} 枚目は「${problem.color.label}」ですが, この色の点数を決めていません.`;
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

// スタック 1 つの枚数と色を, 画像と見比べて確かめるための表示.
// 枠を広げて切り出し, 合わせ目に横線を引き, 右にチップごとの色を並べる (CLI のデバッグ画像から輝度のグラフを除いたもの).
function renderStackCheck(
  image: ImageBitmap,
  stack: StackResult,
  index: number,
  width: number,
): HTMLElement {
  const heading = `スタック #${String(index + 1)}: ${stack.count === null ? "数えられませんでした" : `${String(stack.count)}枚`}`;
  const container = element("div", { className: "stack-check" }, [
    element("h3", { text: heading }),
  ]);
  if (stack.colors.length > 0) {
    container.append(element("p", { text: `色: ${describeColors(stack)}` }));
  }
  const area = viewArea(image, stack);
  if (area.width <= 0 || area.height <= 0) {
    return container;
  }
  const imageHeight = Math.min(
    ((width - LABEL_WIDTH) * area.height) / area.width,
    MAX_VIEW_HEIGHT,
  );
  const scale = imageHeight / area.height;
  const imageWidth = area.width * scale;
  const drawing = createDrawing(imageWidth + LABEL_WIDTH, imageHeight);
  if (drawing === null) {
    container.append(renderCannotDraw());
    return container;
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
  drawSeamsAndLabels(context, stack, {
    roiLeft: (stack.x - area.left) * scale,
    roiTop: (stack.y - area.top) * scale,
    scale,
    labelLeft: imageWidth,
    height: imageHeight,
  });
  container.append(canvas);
  return container;
}

// 色ごとの枚数. 多い色から並べる.
function describeColors(stack: StackResult): string {
  const counts = new Map<string, number>();
  for (const name of stack.colors) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${colorLabel(name)} ×${String(count)}`)
    .join(", ");
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

// 枠 (破線), 合わせ目の線, 右の列のチップごとの色の見本と名前を描く.
function drawSeamsAndLabels(
  context: CanvasRenderingContext2D,
  stack: StackResult,
  layout: StackLayout,
): void {
  const { roiLeft, roiTop, scale, labelLeft, height } = layout;
  const roiWidth = stack.width * scale;
  context.strokeStyle = SEAM_COLOR;
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  context.strokeRect(roiLeft, roiTop, roiWidth, stack.height * scale);
  context.setLineDash([]);

  context.fillStyle = LABEL_BACKGROUND;
  context.fillRect(labelLeft, 0, LABEL_WIDTH, height);

  const seamYs = stack.peaks.map((peak) => roiTop + peak * scale);
  context.lineWidth = 1.5;
  for (const y of seamYs) {
    drawLine(context, roiLeft, roiLeft + roiWidth, y);
    drawLine(context, labelLeft, labelLeft + LABEL_WIDTH, y);
  }

  // チップが多いと区間が狭くなるので, 文字と見本の大きさを区間の高さに合わせる.
  context.textBaseline = "middle";
  stack.colors.forEach((name, chip) => {
    const upper = seamYs[chip];
    const lower = seamYs[chip + 1];
    if (upper === undefined || lower === undefined) {
      return;
    }
    const band = lower - upper;
    const centerY = (upper + lower) / 2;
    const swatch = Math.min(12, band * 0.8);
    const swatchLeft = labelLeft + 6;
    context.fillStyle = findChipColor(name)?.swatch ?? "#fff";
    context.fillRect(swatchLeft, centerY - swatch / 2, swatch, swatch);
    // 黒のチップの見本が背景に埋もれないよう枠を付ける.
    context.strokeStyle = "#ccc";
    context.lineWidth = 1;
    context.strokeRect(swatchLeft, centerY - swatch / 2, swatch, swatch);
    context.fillStyle = LABEL_TEXT;
    context.font = `${String(Math.min(band * 0.7, 14))}px ${FONT_FAMILY}`;
    context.fillText(colorLabel(name), swatchLeft + swatch + 6, centerY);
  });
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
