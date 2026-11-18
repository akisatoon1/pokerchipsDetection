import { parseMatchUrl } from "../../rules/match-url";
import { getMatch } from "../api";
import { element, labeledField } from "../dom";
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
 * トップページを出す. 参加中のマッチの一覧, URL を貼って参加する欄, マッチを作る欄,
 * チップの画面へのリンクを並べる.
 *
 * @param root 画面を入れる要素.
 */
export function renderHomePage(root: HTMLElement): void {
  root.replaceChildren(
    element("h1", { text: "点数計算" }),
    renderSavedMatchesSection(),
    renderPasteSection(),
    renderCreateSection(),
    renderChipLinksSection(),
  );
}

// 数えるだけの画面へのリンク.
function renderChipLinksSection(): HTMLElement {
  return element("section", {}, [
    element("h2", { text: "チップ" }),
    element("ul", {}, [
      element("li", {}, [
        element("a", {
          text: "チップを数える",
          attributes: { href: "/count" },
        }),
      ]),
    ]),
  ]);
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
      forgetSavedMatch(item, saved.matchId);
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
  // リーダーに削除されていたら, このトークンでは戻れないので, 一覧からもトークンからも消す.
  // 最初のラウンドの前なら, マッチの URL から参加し直せる.
  if (self === undefined) {
    forgetSavedMatch(item, saved.matchId);
    return;
  }
  link.textContent = result.value.name;
  item.replaceChildren(
    link,
    element("span", {
      className: "saved-match-detail",
      text: `あなた: ${self.name}`,
    }),
    openedAt,
  );
}

// 戻る意味のなくなったマッチを, 一覧と保存したトークンから消す.
function forgetSavedMatch(item: HTMLLIElement, matchId: string): void {
  removeMembership(matchId);
  const list = item.parentElement;
  item.remove();
  if (list !== null && list.childElementCount === 0) {
    list.replaceWith(renderNoSavedMatches());
  }
}

// 送られた URL を貼ってマッチの画面に移る欄. アドレス欄を使わずに, 送られたマッチを開けるようにするため.
// 参加はマッチの画面で行う.
function renderPasteSection(): HTMLElement {
  const url = element("input", {
    attributes: { required: "", inputmode: "url", autocomplete: "off" },
  });
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "開く",
    attributes: { type: "submit" },
  });
  const form = element("form", {}, [
    labeledField("マッチの URL", url),
    submit,
    message,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    message.textContent = "";
    // 別のサイトの URL を開かせないため, このサイトのマッチの URL だけを受け付ける.
    const parsed = parseMatchUrl(url.value, location.origin);
    if (!parsed.ok) {
      message.textContent = parsed.reason;
      return;
    }
    location.assign(`/m/${encodeURIComponent(parsed.value)}`);
  });
  return element("section", {}, [
    element("h2", { text: "URL を貼って参加する" }),
    element("p", { text: "仲間から送られたマッチの URL を貼ってください." }),
    form,
  ]);
}
