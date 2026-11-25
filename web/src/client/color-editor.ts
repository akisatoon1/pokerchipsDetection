import {
  CHIP_COLORS,
  findChipColor,
  type ChipColorName,
} from "../rules/chip-values";
import {
  correctedColorAt,
  type ChipPosition,
  type ColorCorrections,
} from "../rules/color-corrections";
import { element } from "./dom";

/** 色の分からない (unknown) チップの, 色を選ぶ欄の値. 7 色のどれでもないことを表す. */
const UNKNOWN_VALUE = "";

/** スタック 1 つの「色を直す」の欄. */
export interface ColorEditor {
  /** 開閉できる欄. 確認画像の下に置く. */
  container: HTMLDetailsElement;
  /**
   * 直した色を表示に映す. 色を直したあとに呼ぶ.
   *
   * @param corrections その写真の直した色.
   */
  update(corrections: ColorCorrections): void;
  /**
   * 欄を開き, チップ 1 枚の行に移る. 確認画像の帯を押したときに呼ぶ.
   *
   * @param chipIndex 上から何枚目か (0 から).
   */
  focusChip(chipIndex: number): void;
}

/** 「色を直す」の欄を作るときに使うもの. */
export interface ColorEditorOptions {
  /** スタックの番号 (左から, 0 から). */
  stackIndex: number;
  /** core が判定した色. 上のチップから順. */
  detectedColors: readonly string[];
  /**
   * 色を選んだ, または元に戻したとき.
   *
   * @param position 選んだチップ.
   * @param color 選んだ色. 元に戻したときは null.
   */
  onChange(position: ChipPosition, color: ChipColorName | null): void;
}

/** 欄の中のチップ 1 枚の行. */
interface ColorRow {
  detected: string;
  row: HTMLElement;
  swatch: HTMLElement;
  select: HTMLSelectElement;
  status: HTMLElement;
  revert: HTMLButtonElement;
}

/**
 * スタック 1 つの「色を直す」の欄を作る. 上のチップから順に, 1 枚ずつ色を選ぶ行を並べる.
 *
 * core が色を間違えることがあるので, 確認画像を見た人が直せるようにする (docs/web/app.md).
 * 直したチップは, 直していないチップと見分けられるよう, 行に印と検出のときの色を出す.
 * @param options スタックと, 色を選んだときの処理.
 * @returns 欄. 初めは閉じていて, 直したチップはない表示.
 */
export function createColorEditor(options: ColorEditorOptions): ColorEditor {
  const summary = element("summary");
  const rows = options.detectedColors.map((detected, chipIndex) =>
    createRow(detected, { stackIndex: options.stackIndex, chipIndex }, options),
  );
  const container = element("details", { className: "color-editor" }, [
    summary,
    element("p", {
      className: "note",
      text: "確認画像のチップを押しても, その行に移れます.",
    }),
    element(
      "ol",
      { className: "color-rows" },
      rows.map((row) => row.row),
    ),
  ]);
  const update = (corrections: ColorCorrections): void => {
    let correctedCount = 0;
    rows.forEach((row, chipIndex) => {
      const corrected = correctedColorAt(corrections, {
        stackIndex: options.stackIndex,
        chipIndex,
      });
      if (corrected !== null) {
        correctedCount += 1;
      }
      updateRow(row, corrected);
    });
    summary.textContent =
      correctedCount > 0
        ? `色を直す (直したチップ ${String(correctedCount)} 枚)`
        : "色を直す";
  };
  return {
    container,
    update,
    focusChip: (chipIndex) => {
      const row = rows[chipIndex];
      if (row === undefined) {
        return;
      }
      container.open = true;
      row.row.scrollIntoView({ block: "center" });
      row.select.focus();
    },
  };
}

// チップ 1 枚の行. 「3 枚目」, 色の見本, 色を選ぶ欄, 直したかどうか, 元に戻すボタン.
function createRow(
  detected: string,
  position: ChipPosition,
  options: ColorEditorOptions,
): ColorRow {
  const select = element("select", {
    attributes: {
      "aria-label": `上から ${String(position.chipIndex + 1)} 枚目の色`,
    },
  });
  // 色の分からないチップは, 7 色のどれでもない選択肢を置き, 直すまではそれを選んでおく.
  if (findChipColor(detected) === null) {
    const unknown = element("option", {
      text: "不明",
      attributes: { value: UNKNOWN_VALUE, disabled: "" },
    });
    select.append(unknown);
  }
  for (const color of CHIP_COLORS) {
    select.append(
      element("option", {
        text: color.label,
        attributes: { value: color.name },
      }),
    );
  }
  select.addEventListener("change", () => {
    const color = findChipColor(select.value);
    if (color !== null) {
      options.onChange(position, color.name);
    }
  });
  const revert = element("button", {
    text: "元に戻す",
    attributes: { type: "button" },
  });
  revert.addEventListener("click", () => {
    options.onChange(position, null);
  });
  const swatch = element("span", { className: "chip-swatch" });
  const status = element("span", { className: "color-row-status" });
  const row = element("li", { className: "color-row" }, [
    element("span", {
      className: "color-row-number",
      text: `${String(position.chipIndex + 1)} 枚目`,
    }),
    swatch,
    select,
    status,
    revert,
  ]);
  const created = { detected, row, swatch, select, status, revert };
  updateRow(created, null);
  return created;
}

// 行を, 直した色 (直していなければ null) に合わせる.
function updateRow(row: ColorRow, corrected: ChipColorName | null): void {
  const current = findChipColor(corrected ?? row.detected);
  row.select.value = current?.name ?? UNKNOWN_VALUE;
  row.swatch.style.background = current?.swatch ?? "transparent";
  row.revert.hidden = corrected === null;
  row.row.classList.toggle("corrected", corrected !== null);
  const needsFix = corrected === null && current === null;
  row.row.classList.toggle("needs-fix", needsFix);
  if (corrected !== null) {
    row.status.textContent = `直した (検出: ${findChipColor(row.detected)?.label ?? "不明"})`;
  } else if (needsFix) {
    row.status.textContent = "色が分かりません";
  } else {
    row.status.textContent = "";
  }
}
