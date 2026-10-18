// Android アプリとの連絡口 (bridge). アプリの中の WebView でだけ使える (docs/web/app.md).

/**
 * アプリが WebView のページに入れる物. androidx.webkit の addWebMessageListener が作る.
 * 名前はアプリの WebBridge.BRIDGE_NAME と同じにする.
 */
interface AppBridge {
  postMessage(message: string): void;
}

declare global {
  interface Window {
    pokerchipApp?: AppBridge;
  }
}

/**
 * アプリに文字のコピーを頼む. WebView ではブラウザのコピーの機能が確実には動かないため.
 *
 * アプリは接続先の URL だけをコピーする. 返事はないので, 頼めたら成功とみなす.
 * @param text コピーする文字.
 * @returns 頼めたら true. アプリの中でなければ false.
 */
export function copyTextInApp(text: string): boolean {
  const bridge = window.pokerchipApp;
  if (bridge === undefined) {
    return false;
  }
  bridge.postMessage(JSON.stringify({ type: "copyText", text }));
  return true;
}
