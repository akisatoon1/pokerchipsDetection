import type { ChipValues } from "../../rules/chip-values";
import { createChipValueFields } from "../chip-values-fields";
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

/**
 * 色ごとの点数を入れて保存する欄.
 *
 * 保存した点数を入れた状態で出す. 1 つでも受け付けられない欄があれば, どれも保存しない.
 * @param onSaved 保存できたときに, 保存した点数を受け取る.
 * @returns 欄をまとめた form.
 */
export function renderChipValuesForm(
  onSaved: (values: ChipValues) => void,
): HTMLFormElement {
  const fields = createChipValueFields(loadChipValues());
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const form = element("form", {}, [
    fields.container,
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
    const values = fields.read();
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
