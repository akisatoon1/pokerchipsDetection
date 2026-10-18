import { renderCreatePage } from "./pages/create-page";
import { renderMatchPage } from "./pages/match-page";

// パスで画面を振り分ける. / はマッチを作る画面, /m/{matchId} はマッチの画面.
const root = document.getElementById("app");
if (root !== null) {
  const matchPath = /^\/m\/([^/]+)\/?$/.exec(location.pathname);
  const matchId = matchPath?.[1];
  if (matchId === undefined) {
    renderCreatePage(root);
  } else {
    void renderMatchPage(root, decodeURIComponent(matchId));
  }
}
