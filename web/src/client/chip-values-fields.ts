import {
  CHIP_COLORS,
  parseChipValue,
  toChipValuesRecord,
  validateChipValues,
  type ChipColor,
  type ChipColorName,
  type ChipValues,
} from "../rules/chip-values";
import { element } from "./dom";

/** 色ごとの点数の欄. マッチを作る欄と, リーダーが点数を変える欄で使う. */
export interface ChipValueFields {
  /** 7 色の見本と点数の欄をまとめた fieldset. form に入れて使う. */
  container: HTMLFieldSetElement;
  /**
   * 欄を読む. 受け付けられない欄があれば, その欄に理由を出し, 最初の欄に移る.
   *
   * @returns 色ごとの点数. 決まりを満たさなければ null.
   */
  read(): ChipValues | null;
}

/** 1 つの色の欄と, その欄の誤りを出す場所. */
interface ChipValueField {
  color: ChipColor;
  input: HTMLInputElement;
  error: HTMLElement;
}

/**
 * 色ごとの点数の欄を作る. 7 色の見本と, チップ 1 枚の点数の欄を並べる.
 *
 * 灰は実物では白に見えるので, 見本を並べてどのチップのことか分かるようにする (docs/web/app.md).
 * @param initial 欄に入れておく点数. 入っていない色は空欄にする.
 * @returns 欄と, 欄を読む関数.
 */
export function createChipValueFields(initial: ChipValues): ChipValueFields {
  const fields = CHIP_COLORS.map((color) =>
    createField(color, initial.get(color.name)),
  );
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const container = element("fieldset", { className: "chip-values-form" }, [
    element("legend", { text: "チップ 1 枚の点数" }),
    element("p", {
      className: "note",
      text: "このチップセットで使わない色は空欄にします.",
    }),
    ...fields.map(renderField),
    message,
  ]);
  return {
    container,
    read: () => readFields(fields, message),
  };
}

function createField(
  color: ChipColor,
  points: number | undefined,
): ChipValueField {
  const errorId = `chip-value-error-${color.name}`;
  const input = element("input", {
    attributes: {
      inputmode: "numeric",
      autocomplete: "off",
      placeholder: "使わない",
      "aria-describedby": errorId,
    },
  });
  input.value = points === undefined ? "" : String(points);
  const error = element("span", {
    className: "error",
    attributes: { id: errorId },
  });
  return { color, input, error };
}

function renderField(field: ChipValueField): HTMLElement {
  const swatch = element("span", { className: "chip-swatch" });
  swatch.style.backgroundColor = field.color.swatch;
  return element("label", { className: "chip-value-row" }, [
    swatch,
    element("span", { className: "chip-value-label", text: field.color.label }),
    field.input,
    field.error,
  ]);
}

// すべての欄を読む. 欄ごとの誤りはその欄に, 全体の誤り (1 色もない) は欄の下に出す.
function readFields(
  fields: ChipValueField[],
  message: HTMLElement,
): ChipValues | null {
  message.textContent = "";
  const values = new Map<ChipColorName, number>();
  let firstInvalid: HTMLInputElement | null = null;
  for (const field of fields) {
    const parsed = parseChipValue(field.input.value);
    field.error.textContent = parsed.ok ? "" : parsed.reason;
    field.input.setAttribute("aria-invalid", String(!parsed.ok));
    if (!parsed.ok) {
      firstInvalid ??= field.input;
    } else if (parsed.value !== null) {
      values.set(field.color.name, parsed.value);
    }
  }
  if (firstInvalid !== null) {
    firstInvalid.focus();
    return null;
  }
  // 1 色もないときの決まりは, サーバーと同じ規則で確かめる.
  const validated = validateChipValues(toChipValuesRecord(values));
  if (!validated.ok) {
    message.textContent = validated.reason;
    fields[0]?.input.focus();
    return null;
  }
  return validated.value;
}
