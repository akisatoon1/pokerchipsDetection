import {
  CHIP_COLORS,
  findChipColor,
  type ChipColorName,
} from "../rules/chip-values";
import {
  correctedColorAt,
  NO_CORRECTIONS,
  type ChipPosition,
  type ColorCorrections,
} from "../rules/color-corrections";
import { element } from "./dom";

/** 確認画像の中の, チップ 1 枚の帯の位置. 確認画像の高さに対する割合 (0 から 1). */
export interface BandPosition {
  top: number;
  bottom: number;
}

/** 確認画像の上に重ねる, チップの色を直すパレット. */
export interface ColorPicker {
  /** 押した帯の枠とパレット. 確認画像と同じ大きさの, 位置を決める要素 (position: relative) に入れる. */
  layer: HTMLElement;
  /**
   * パレットを開く. 確認画像の帯を押したときに呼ぶ.
   *
   * @param chipIndex 上から何枚目か (0 から).
   * @param band 帯の位置. パレットを帯の上か下に出す.
   */
  open(chipIndex: number, band: BandPosition): void;
  /**
   * 直した色を覚える. パレットに今の色と, 直したかどうかを出すため.
   *
   * @param corrections その写真の直した色.
   */
  update(corrections: ColorCorrections): void;
}

/** パレットを作るときに使うもの. */
export interface ColorPickerOptions {
  /** スタックの番号 (左から, 0 から). */
  stackIndex: number;
  /** core が判定した色. 上のチップから順. */
  detectedColors: readonly string[];
  /**
   * 確認画像の右の, 色のラベルの列の幅. 確認画像の幅に対する割合.
   *
   * パレットはラベルの列を隠さないよう, その左 (画像の上) に出す.
   */
  labelColumnRatio: number;
  /**
   * 色を選んだ, または元に戻したとき.
   *
   * @param position 直すチップ.
   * @param color 選んだ色. 元に戻したときは null.
   */
  onChange(position: ChipPosition, color: ChipColorName | null): void;
}

/**
 * 確認画像の帯を押したときに出す, 色を直すパレットを作る.
 *
 * 確認画像を見ながらその場で直せるよう, パレットは押した帯のすぐ上か下に出す (docs/web/app.md).
 * ページを拡大しても, パレットは画像といっしょに拡大される.
 * @param options スタックと, 色を選んだときの処理.
 * @returns パレット. 初めは閉じている.
 */
export function createColorPicker(options: ColorPickerOptions): ColorPicker {
  const highlight = element("div", { className: "chip-highlight" });
  const palette = element("div", {
    className: "color-palette",
    attributes: { role: "dialog" },
  });
  const layer = element("div", { className: "color-picker" }, [
    highlight,
    palette,
  ]);
  let corrections = NO_CORRECTIONS;
  let openChip: number | null = null;

  // パレットの外を押したら閉じる. 帯を押したときは, その帯で開き直す (確認画像の click が先に動く).
  const onOutside = (event: Event): void => {
    const area = layer.parentElement;
    if (event.target instanceof Node && area?.contains(event.target) !== true) {
      close();
    }
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      close();
    }
  };
  const close = (): void => {
    openChip = null;
    layer.hidden = true;
    document.removeEventListener("click", onOutside, true);
    document.removeEventListener("keydown", onKey);
  };
  const choose = (chipIndex: number, color: ChipColorName | null): void => {
    close();
    options.onChange({ stackIndex: options.stackIndex, chipIndex }, color);
  };
  close();

  return {
    layer,
    open: (chipIndex, band) => {
      const detected = options.detectedColors[chipIndex];
      if (detected === undefined) {
        return;
      }
      const corrected = correctedColorAt(corrections, {
        stackIndex: options.stackIndex,
        chipIndex,
      });
      placeHighlight(highlight, band);
      placePalette(palette, band, options.labelColumnRatio);
      palette.replaceChildren(
        ...renderPaletteContent({
          chipIndex,
          detected,
          corrected,
          choose,
          close,
        }),
      );
      layer.hidden = false;
      if (openChip === null) {
        document.addEventListener("click", onOutside, true);
        document.addEventListener("keydown", onKey);
      }
      openChip = chipIndex;
    },
    update: (next) => {
      corrections = next;
    },
  };
}

// 押した帯を白い枠で囲む. どのチップを直しているかを分かるようにするため.
function placeHighlight(highlight: HTMLElement, band: BandPosition): void {
  highlight.style.top = percent(band.top);
  highlight.style.height = percent(band.bottom - band.top);
}

// 帯が確認画像の上半分にあれば帯の下に, 下半分にあれば帯の上に出す. 画像からはみ出さないようにするため.
// 横はラベルの列の左 (画像の上) に出す. 直しているチップのラベルを隠さないため.
function placePalette(
  palette: HTMLElement,
  band: BandPosition,
  labelColumnRatio: number,
): void {
  const isUpperHalf = (band.top + band.bottom) / 2 < 0.5;
  palette.style.top = isUpperHalf ? percent(band.bottom) : "";
  palette.style.bottom = isUpperHalf ? "" : percent(1 - band.top);
  palette.style.right = percent(labelColumnRatio);
}

function percent(ratio: number): string {
  return `${String(ratio * 100)}%`;
}

/** パレットの中身を作るのに使うもの. */
interface PaletteContent {
  chipIndex: number;
  /** core が判定した色の名前. */
  detected: string;
  /** 直した色. 直していなければ null. */
  corrected: ChipColorName | null;
  choose(chipIndex: number, color: ChipColorName | null): void;
  close(): void;
}

// 「上から 3 枚目 (検出: 青)」, 7 色のボタン, 「元に戻す」と「閉じる」.
// 今の色のボタンには印を付ける. 直したチップには, 検出のときの色を出す.
function renderPaletteContent(content: PaletteContent): HTMLElement[] {
  const { chipIndex, detected, corrected } = content;
  const detectedLabel = findChipColor(detected)?.label ?? "不明";
  const current = corrected ?? detected;
  const title = `上から ${String(chipIndex + 1)} 枚目${corrected !== null ? ` (検出: ${detectedLabel})` : findChipColor(detected) === null ? " (色が分かりません)" : ""}`;
  const choices = CHIP_COLORS.map((color) => {
    const swatch = element("span", { className: "chip-swatch" });
    swatch.style.background = color.swatch;
    const button = element(
      "button",
      {
        className: "color-choice",
        attributes: {
          type: "button",
          "aria-pressed": String(color.name === current),
        },
      },
      [swatch, element("span", { text: color.label })],
    );
    button.addEventListener("click", () => {
      content.choose(chipIndex, color.name);
    });
    return button;
  });
  const revert = element("button", {
    text: "元に戻す",
    attributes: { type: "button" },
  });
  revert.disabled = corrected === null;
  revert.addEventListener("click", () => {
    content.choose(chipIndex, null);
  });
  const closeButton = element("button", {
    text: "閉じる",
    attributes: { type: "button" },
  });
  closeButton.addEventListener("click", () => {
    content.close();
  });
  return [
    element("p", { className: "color-palette-title", text: title }),
    element("div", { className: "color-choices" }, choices),
    element("div", { className: "color-palette-actions" }, [
      revert,
      closeButton,
    ]),
  ];
}
