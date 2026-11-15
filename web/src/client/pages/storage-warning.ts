import { isInApp } from "../app-bridge";
import { element } from "../dom";

/**
 * シークレット (プライベート) モードで開かないよう注意する文を作る.
 *
 * トークンはブラウザに保存するので, シークレットのタブを閉じると消え, 本人として戻れなくなる (docs/web/app.md).
 * ページからシークレットかを確実に知る方法はないので, いつも出す.
 * トークンを受け取る直前 (マッチを作る欄と参加する欄) に置く.
 * @returns 注意の文. Android アプリの中では空 (WebView にシークレットのモードはないため).
 */
export function renderPrivateModeWarning(): HTMLElement[] {
  if (isInApp()) {
    return [];
  }
  return [
    element("p", {
      className: "warning",
      text: "シークレット (プライベート) モードでは開かないでください. タブやブラウザを閉じると, このマッチの本人として戻れなくなります.",
    }),
  ];
}
