/** 要素を作るときに付けるもの. */
export interface ElementOptions {
  className?: string;
  // 文字は必ず textContent で入れる. 利用者が入れた文字を HTML として解釈させないため (docs/web/security.md).
  text?: string;
  attributes?: Record<string, string>;
}

/**
 * 要素を作る.
 *
 * @param tag 要素の名前.
 * @param options クラス, 文字, 属性.
 * @param children 子の要素.
 * @returns 作った要素.
 */
export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  if (options.className !== undefined) {
    created.className = options.className;
  }
  if (options.text !== undefined) {
    created.textContent = options.text;
  }
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    created.setAttribute(name, value);
  }
  created.append(...children);
  return created;
}

/**
 * ラベルの付いた入力欄を作る.
 *
 * @param label 見出しの文字.
 * @param input 入力欄.
 * @returns label 要素.
 */
export function labeledField(
  label: string,
  input: HTMLInputElement,
): HTMLLabelElement {
  return element("label", { className: "field" }, [
    element("span", { text: label }),
    input,
  ]);
}
