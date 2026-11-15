import { renderChipValuesPage } from "./pages/chip-values-page";
import { renderCountPage } from "./pages/count-page";
import { renderHomePage } from "./pages/home-page";
import { renderMatchPage } from "./pages/match-page";

// パスで画面を振り分ける. / はトップページ (参加中のマッチとマッチを作る欄), /m/{matchId} はマッチの画面,
// /count は数えるだけの画面, /chips は色と点数の設定画面.
const root = document.getElementById("app");
if (root !== null) {
  const matchPath = /^\/m\/([^/]+)\/?$/.exec(location.pathname);
  const matchId = matchPath?.[1];
  if (/^\/count\/?$/.test(location.pathname)) {
    renderCountPage(root);
  } else if (/^\/chips\/?$/.test(location.pathname)) {
    renderChipValuesPage(root);
  } else if (matchId === undefined) {
    renderHomePage(root);
  } else {
    void renderMatchPage(root, decodeURIComponent(matchId));
  }
}
