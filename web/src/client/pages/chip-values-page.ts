import {
  CHIP_COLORS,
  parseChipValue,
  type ChipColor,
  type ChipColorName,
  type ChipValues,
} from "../../rules/chip-values";
import { loadChipValues, saveChipValues } from "../chip-values-store";
import { element } from "../dom";

/**
 * 色と点数の設定画面を出す.
 *
 * @param root 画面を入れる要素.
 */
export function renderChipValuesPage(root: HTMLElement): void {
  const status = element("p", { attributes: { role: "status" } });
  const form = renderChipValuesForm(() => {
    status.textContent = "保存しました.";
  });
  // 直し始めたら「保存しました」を消す. 保存したあとの入力が保存済みに見えないようにするため.
  form.addEventListener("input", () => {
    status.textContent = "";
  });
  root.replaceChildren(
    element("h1", { text: "色と点数の設定" }),
    form,
    status,
    element("p", {}, [
      element("a", { text: "トップページへ", attributes: { href: "/" } }),
    ]),
  );
}

/** 1 つの色の欄と, その欄の誤りを出す場所. */
interface ChipValueField {
  color: ChipColor;
  input: HTMLInputElement;
  error: HTMLElement;
}

/**
 * 色ごとの点数を入れて保存する欄. 7 色の見本と, チップ 1 枚の点数の欄を並べる.
 *
 * 保存した点数を入れた状態で出す. 1 つでも受け付けられない欄があれば, どれも保存しない.
 * @param onSaved 保存できたときに, 保存した点数を受け取る.
 * @returns 欄をまとめた form.
 */
export function renderChipValuesForm(
  onSaved: (values: ChipValues) => void,
): HTMLFormElement {
  const saved = loadChipValues();
  const fields = CHIP_COLORS.map((color) =>
    createField(color, saved.get(color.name)),
  );
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const form = element("form", { className: "chip-values-form" }, [
    element("p", {
      text: "チップ 1 枚の点数を入れてください. このチップセットで使わない色は空欄にします.",
    }),
    ...fields.map(renderField),
    element("button", { text: "保存", attributes: { type: "submit" } }),
    message,
    element("p", {
      className: "note",
      text: "この設定はこのブラウザにだけ保存され, どのマッチでも使います.",
    }),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    message.textContent = "";
    const values = readFields(fields);
    if (values === null) {
      return;
    }
    try {
      saveChipValues(values);
    } catch {
      message.textContent =
        "このブラウザでは保存できませんでした. プライベートモードになっていないかを確かめてください.";
      return;
    }
    onSaved(values);
  });
  return form;
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

// すべての欄を読む. 受け付けられない欄があれば, その欄に理由を出し, 最初の欄に移って null を返す.
function readFields(fields: ChipValueField[]): ChipValues | null {
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
  return values;
}
