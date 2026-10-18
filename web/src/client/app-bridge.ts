import { z } from "zod";

// Android アプリとの連絡口 (bridge). アプリの中の WebView でだけ使える (docs/web/app.md).

/**
 * アプリが WebView のページに入れる物. androidx.webkit の addWebMessageListener が作る.
 * 名前はアプリの WebBridge.BRIDGE_NAME と同じにする.
 */
interface AppBridge {
  postMessage(message: string): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ): void;
}

declare global {
  interface Window {
    pokerchipApp?: AppBridge;
  }
}

// アプリが返す, チップから求めた持ち点. 欄に入れる前に形を確かめる.
const chipPointsMessage = z
  .object({ type: z.literal("chipPoints"), points: z.number().int() })
  .strict();

// 持ち点が返ってきたときに呼ぶもの. 頼むたびに置き換える (欄は 1 つなので, 待つのは最後の 1 回だけ).
let onChipPoints: ((points: number) => void) | null = null;

let isListening = false;

/**
 * Android アプリの中で開かれているかを返す. アプリの中でだけ出すボタンに使う.
 *
 * @returns アプリが bridge を入れていれば true.
 */
export function isInApp(): boolean {
  return window.pokerchipApp !== undefined;
}

/**
 * アプリに検出画面を開かせ, チップから求めた持ち点を受け取る.
 *
 * 利用者が検出画面で「この点数を入れる」を押したときだけ返ってくる. 戻るで閉じたら何も返らない.
 * @param onPoints 持ち点を受ける. 範囲の確かめは, 欄に入れたあとの送信でサーバーが行う.
 * @returns 頼めたら true. アプリの中でなければ false.
 */
export function requestChipPoints(onPoints: (points: number) => void): boolean {
  const bridge = window.pokerchipApp;
  if (bridge === undefined) {
    return false;
  }
  onChipPoints = onPoints;
  if (!isListening) {
    bridge.addEventListener("message", handleAppMessage);
    isListening = true;
  }
  bridge.postMessage(JSON.stringify({ type: "startChipInput" }));
  return true;
}

function handleAppMessage(event: MessageEvent<unknown>): void {
  if (typeof event.data !== "string") {
    return;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    // 形の違うメッセージは, 知らないものとして無視する.
    return;
  }
  const message = chipPointsMessage.safeParse(parsed);
  if (!message.success || onChipPoints === null) {
    return;
  }
  const callback = onChipPoints;
  onChipPoints = null;
  callback(message.data.points);
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
