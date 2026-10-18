import { getMatch } from "../api";
import { element } from "../dom";
import {
  listSavedMatches,
  removeMembership,
  type SavedMatch,
} from "../membership";
import { renderCreateSection } from "./create-section";

/** 一覧に出す, 最後に開いた日時の書き方. */
const OPENED_AT_FORMAT = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// 参加中のマッチがないときの文. 一覧の項目がすべて消えたときにも使う.
function renderNoSavedMatches(): HTMLElement {
  return element("p", { text: "まだ参加しているマッチはありません." });
}

/**
 * トップページを出す. 参加中のマッチの一覧と, マッチを作る欄を並べる.
 *
 * @param root 画面を入れる要素.
 */
export function renderHomePage(root: HTMLElement): void {
  root.replaceChildren(
    element("h1", { text: "点数計算" }),
    renderSavedMatchesSection(),
    renderCreateSection(),
  );
}

// 参加中のマッチの一覧. URL をなくしても, 参加したマッチに戻れるようにするため.
function renderSavedMatchesSection(): HTMLElement {
  const saved = listSavedMatches();
  const section = element("section", {}, [
    element("h2", { text: "参加中のマッチ" }),
  ]);
  if (saved.length === 0) {
    section.append(renderNoSavedMatches());
    return section;
  }
  const list = element("ul", { className: "saved-matches" });
  section.append(list);
  // 一覧の順 (最後に開いた順) を保つため, 項目の場所を先に作ってから中身を入れる.
  for (const match of saved) {
    const item = element("li", { text: "読み込み中…" });
    list.append(item);
    void fillSavedMatchItem(item, match);
  }
  return section;
}

// マッチ名と自分の名前は保存せず, API で読む. 名前の変更やマッチの削除を反映するため (docs/web/app.md).
async function fillSavedMatchItem(
  item: HTMLLIElement,
  saved: SavedMatch,
): Promise<void> {
  const result = await getMatch(saved.matchId);
  const link = element("a", {
    attributes: { href: `/m/${encodeURIComponent(saved.matchId)}` },
  });
  const openedAt = element("span", {
    className: "saved-match-detail",
    text: `最後に開いた日時 ${OPENED_AT_FORMAT.format(saved.lastOpenedAt)}`,
  });
  if (!result.ok) {
    // 削除されたマッチには戻る意味がないので, 一覧からもトークンからも消す.
    if (result.status === 404) {
      removeMembership(saved.matchId);
      const list = item.parentElement;
      item.remove();
      if (list !== null && list.childElementCount === 0) {
        list.replaceWith(renderNoSavedMatches());
      }
      return;
    }
    // つながらないなどのときは消さない. あとで読めるかもしれないため.
    link.textContent = "読み込めませんでした";
    item.replaceChildren(
      link,
      element("span", {
        className: "saved-match-detail error",
        text: result.error,
      }),
      openedAt,
    );
    return;
  }
  const self = result.value.players.find(
    (player) => player.id === saved.membership.playerId,
  );
  link.textContent = result.value.name;
  item.replaceChildren(
    link,
    element("span", {
      className: "saved-match-detail",
      text: `あなた: ${self?.name ?? "(見つかりません)"}`,
    }),
    openedAt,
  );
}
