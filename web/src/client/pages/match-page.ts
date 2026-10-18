import { MAX_PLAYER_NAME_LENGTH } from "../../rules/limits";
import { getMatch, joinMatch, type MatchView } from "../api";
import { element, labeledField } from "../dom";
import { loadMembership, saveMembership, type Membership } from "../membership";

/**
 * マッチの画面を出す.
 *
 * 他の人の入力はポーリングしない. 開いたときとリロードしたときに API から読み直す (docs/web/app.md).
 * @param root 画面を入れる要素.
 * @param matchId マッチの id.
 */
export async function renderMatchPage(
  root: HTMLElement,
  matchId: string,
): Promise<void> {
  root.replaceChildren(element("p", { text: "読み込み中…" }));
  const result = await getMatch(matchId);
  if (!result.ok) {
    root.replaceChildren(
      element("h1", { text: "点数計算" }),
      element("p", { className: "error", text: result.error }),
      element("a", { text: "マッチを作る", attributes: { href: "/" } }),
    );
    return;
  }
  const match = result.value;
  const membership = loadMembership(matchId);
  const sections: HTMLElement[] = [
    element("h1", { text: match.name }),
    element("p", { text: `初期点数 ${String(match.initialPoints)}` }),
  ];
  if (membership === null) {
    sections.push(renderJoinSection(root, matchId));
  }
  sections.push(renderShareSection(), renderPlayersSection(match, membership));
  root.replaceChildren(...sections);
}

// このブラウザがまだ参加していなければ, 名前を入れて参加する欄を出す.
function renderJoinSection(root: HTMLElement, matchId: string): HTMLElement {
  const name = element("input", {
    attributes: { required: "", maxlength: String(MAX_PLAYER_NAME_LENGTH) },
  });
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "参加する",
    attributes: { type: "submit" },
  });
  const form = element("form", {}, [
    labeledField("あなたの名前", name),
    submit,
    message,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    void joinMatch(matchId, name.value).then((result) => {
      if (!result.ok) {
        message.textContent = result.error;
        submit.disabled = false;
        return;
      }
      try {
        saveMembership(matchId, result.value);
      } catch {
        message.textContent =
          "このブラウザに保存できませんでした. プライベートモードを外してやり直してください";
        submit.disabled = false;
        return;
      }
      void renderMatchPage(root, matchId);
    });
  });
  return element("section", {}, [element("h2", { text: "参加する" }), form]);
}

function renderShareSection(): HTMLElement {
  return element("section", {}, [
    element("h2", { text: "仲間を呼ぶ" }),
    element("p", { text: "この URL を送ると, 仲間が参加できます." }),
    element("input", {
      className: "share-url",
      attributes: { readonly: "", value: location.href },
    }),
  ]);
}

function renderPlayersSection(
  match: MatchView,
  membership: Membership | null,
): HTMLElement {
  const items = match.players.map((player) => {
    const marks: string[] = [];
    if (player.id === match.leaderPlayerId) {
      marks.push("リーダー");
    }
    if (player.id === membership?.playerId) {
      marks.push("あなた");
    }
    const suffix = marks.length > 0 ? ` (${marks.join(", ")})` : "";
    return element("li", { text: `${player.name}${suffix}` });
  });
  return element("section", {}, [
    element("h2", { text: `プレイヤー (${String(match.players.length)} 人)` }),
    element("ul", {}, items),
  ]);
}
