import { z } from "zod";
import {
  parseAnalysisResult,
  type AnalysisResult,
} from "../rules/analysis-result";
import type { RuleResult } from "../rules/rule-result";

// ブラウザの中でチップを検出する. core を WASM にしたもの (wasm/bindings.cpp) を呼ぶ.
// WASM とモデルは scripts/build_wasm.sh が public/detector/ に置き, Static Assets で配る.

/** WASM の core の場所. ビルドに含めず, 実行時に読む (Vite に public/ の JS を束ねさせないため). */
const CORE_URL = "/detector/pokerchip-core.js";

/** モデル (ONNX) の場所. */
const MODEL_URL = "/detector/chip_detector.onnx";

/**
 * WASM の core が持つ, スタックの検出器. wasm/bindings.cpp の Detector.
 *
 * ページを開いている間は使い回すので, 解放 (delete) はしない.
 */
interface CoreDetector {
  analyze(pixels: Uint8ClampedArray, width: number, height: number): unknown;
}

/** WASM の core のモジュール. wasm/bindings.cpp の EMSCRIPTEN_BINDINGS. */
interface CoreModule {
  createDetector(model: Uint8Array): unknown;
}

const createdSchema = z.union([
  z.object({
    ok: z.literal(true),
    detector: z.custom<CoreDetector>(isCoreDetector),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

const analyzedSchema = z.union([
  z.object({ ok: z.literal(true), json: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

/** 画像を解析した結果と, かかった時間. */
export interface Analysis {
  /** 解析の結果. */
  result: AnalysisResult;
  /**
   * 解析した画像. 向きを直し, 色空間を変換していないもの (core が見たとおりの色).
   *
   * 結果の座標はこの画像のピクセル. 使い終えたら呼んだ側が close する.
   */
  image: ImageBitmap;
  /** 画像の幅 (px). 向きを直したあとのもの. */
  width: number;
  /** 画像の高さ (px). 向きを直したあとのもの. */
  height: number;
  /** 検出器の読み込みにかかった時間 (ミリ秒). 2 回目からは 0. */
  loadMilliseconds: number;
  /** 画像を画素にするのにかかった時間 (ミリ秒). */
  decodeMilliseconds: number;
  /** 解析にかかった時間 (ミリ秒). */
  analyzeMilliseconds: number;
}

// 検出器の読み込みは重い (WASM とモデルで約 15MB) ので, ページを開いている間は 1 つを使い回す.
let detectorPromise: Promise<RuleResult<CoreDetector>> | null = null;

/**
 * 画像を解析し, スタックごとの枚数と色を求める.
 *
 * 初めて呼んだときに検出器を読み込む. 読み込みに失敗したら, 次に呼んだときに読み込み直す.
 * @param file 利用者が撮影した, または選んだ画像.
 * @returns 解析の結果とかかった時間. 読み込めない, 画像を読めない, 解析に失敗したら ok: false と理由.
 */
export async function analyzeImage(file: Blob): Promise<RuleResult<Analysis>> {
  const loadStarted = performance.now();
  const isFirstLoad = detectorPromise === null;
  detectorPromise ??= loadDetector();
  const detector = await detectorPromise;
  if (!detector.ok) {
    detectorPromise = null;
    return detector;
  }
  const loadMilliseconds = isFirstLoad ? performance.now() - loadStarted : 0;

  const decodeStarted = performance.now();
  const image = await decodeImage(file);
  if (!image.ok) {
    return image;
  }
  const decodeMilliseconds = performance.now() - decodeStarted;

  // 解析は画面を止めるので, 先に「解析中」を描かせてから始める.
  await nextFrame();
  const analyzeStarted = performance.now();
  const result = runDetector(detector.value, image.value.pixels);
  const analyzeMilliseconds = performance.now() - analyzeStarted;
  const { bitmap } = image.value;
  if (!result.ok) {
    bitmap.close();
    return result;
  }
  return {
    ok: true,
    value: {
      result: result.value,
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      loadMilliseconds,
      decodeMilliseconds,
      analyzeMilliseconds,
    },
  };
}

// WASM の core で画素を解析し, 返った JSON を読む.
function runDetector(
  detector: CoreDetector,
  pixels: ImageData,
): RuleResult<AnalysisResult> {
  const analyzed = analyzedSchema.safeParse(
    detector.analyze(pixels.data, pixels.width, pixels.height),
  );
  if (!analyzed.success) {
    return { ok: false, reason: "解析の結果の形が違います" };
  }
  if (!analyzed.data.ok) {
    return {
      ok: false,
      reason: `解析できませんでした: ${analyzed.data.error}`,
    };
  }
  return parseAnalysisResult(analyzed.data.json);
}

// WASM の core とモデルを読み, 検出器を作る.
async function loadDetector(): Promise<RuleResult<CoreDetector>> {
  let core: CoreModule;
  let model: Uint8Array;
  try {
    [core, model] = await Promise.all([loadCore(), fetchModel()]);
  } catch (error) {
    return {
      ok: false,
      reason: `検出の仕組みを読み込めませんでした: ${String(error)}`,
    };
  }
  const created = createdSchema.safeParse(core.createDetector(model));
  if (!created.success) {
    return { ok: false, reason: "検出の仕組みの形が違います" };
  }
  if (!created.data.ok) {
    return {
      ok: false,
      reason: `モデルを読めませんでした: ${created.data.error}`,
    };
  }
  return { ok: true, value: created.data.detector };
}

// WASM の core を読む. Emscripten の MODULARIZE で作った, モジュールを返す関数を呼ぶ.
async function loadCore(): Promise<CoreModule> {
  const imported: unknown = await import(/* @vite-ignore */ CORE_URL);
  if (!hasFactory(imported)) {
    throw new Error("WASM の core の形が違います");
  }
  const core = await imported.default();
  if (!isCoreModule(core)) {
    throw new Error("WASM の core の形が違います");
  }
  return core;
}

async function fetchModel(): Promise<Uint8Array> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`モデルを取れませんでした (${String(response.status)})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** 読み込んだ画像. 確認画像を描くための画像と, core に渡す画素. */
interface DecodedImage {
  bitmap: ImageBitmap;
  pixels: ImageData;
}

/**
 * 画像を, 向きを直した RGBA の画素にする.
 *
 * EXIF の向きは反映する. Linux の cv::imread も反映するので, 同じ向きで解析するため.
 * 色空間は変換しない (colorSpaceConversion: "none"). cv::imread は ICC を無視して値をそのまま読み,
 * 基準色もその値から作っているため (docs/architecture.md の 10).
 * 確認画像にも同じ画像を使う. 読み込みを 1 回で済ませ, core が見たとおりの色を出すため.
 */
async function decodeImage(file: Blob): Promise<RuleResult<DecodedImage>> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
      colorSpaceConversion: "none",
    });
  } catch {
    return { ok: false, reason: "画像を読めませんでした" };
  }
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (context === null) {
    bitmap.close();
    return { ok: false, reason: "画像を読めませんでした" };
  }
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  // 画素を取り出したら canvas は要らない. iPhone の Safari は canvas の使うメモリの合計にも上限があるため, すぐ手放す.
  canvas.width = 0;
  canvas.height = 0;
  return { ok: true, value: { bitmap, pixels } };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

function hasFactory(
  value: unknown,
): value is { default: () => Promise<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof value.default === "function"
  );
}

function isCoreModule(value: unknown): value is CoreModule {
  return (
    typeof value === "object" &&
    value !== null &&
    "createDetector" in value &&
    typeof value.createDetector === "function"
  );
}

function isCoreDetector(value: unknown): value is CoreDetector {
  return (
    typeof value === "object" &&
    value !== null &&
    "analyze" in value &&
    typeof value.analyze === "function"
  );
}
