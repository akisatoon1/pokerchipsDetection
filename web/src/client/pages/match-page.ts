import { MAX_PLAYER_NAME_LENGTH } from "../../rules/limits";
import {
  deleteMatch,
  getMatch,
  joinMatch,
  renamePlayer,
  startRound,
  type MatchView,
} from "../api";
import { copyTextInApp } from "../app-bridge";
import { element, labeledField } from "../dom";
import {
  loadMembership,
  recordMatchOpened,
  removeMembership,
  saveMembership,
  type Membership,
} from "../membership";
import { formatDelta, renderRoundsSection } from "./rounds-section";

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
    // 削除されたマッチには戻る意味がないので, 保存したトークンも消す.
    if (result.status === 404) {
      removeMembership(matchId);
    }
    root.replaceChildren(
      element("h1", { text: "点数計算" }),
      element("p", { className: "error", text: result.error }),
      element("a", { text: "トップページへ", attributes: { href: "/" } }),
    );
    return;
  }
  const match = result.value;
  const membership = loadMembership(matchId);
  recordMatchOpened(matchId);
  const sections: HTMLElement[] = [
    element("h1", { text: match.name }),
    element("p", { text: `初期点数 ${String(match.initialPoints)}` }),
  ];
  if (membership === null) {
    sections.push(
      match.isJoinOpen
        ? renderJoinSection(root, matchId)
        : element("p", {
            text: "ラウンドが始まったので, 参加の受付は終わりました.",
          }),
    );
  }
  if (match.isJoinOpen) {
    sections.push(renderShareSection());
  }
  sections.push(
    renderPlayersSection(match, membership, () => {
      void renderMatchPage(root, matchId);
    }),
  );
  if (membership !== null && membership.playerId === match.leaderPlayerId) {
    sections.push(renderLeaderSection(root, match, membership));
  }
  if (match.rounds.length > 0) {
    sections.push(renderTotalsSection(match));
  }
  sections.push(
    renderRoundsSection(match, membership, () => {
      void renderMatchPage(root, matchId);
    }),
  );
  // 削除は取り返しがつかないので, ほかの操作から離して最後に置く (docs/web/app.md).
  if (membership !== null && membership.playerId === match.leaderPlayerId) {
    sections.push(renderDeleteSection(match, membership));
  }
  root.replaceChildren(...sections);
}

// リーダーにだけ出す操作. 権限の確認はサーバーでも毎回行う.
function renderLeaderSection(
  root: HTMLElement,
  match: MatchView,
  membership: Membership,
): HTMLElement {
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const start = element("button", { text: "ラウンドを始める" });
  start.disabled = !match.canStartRound;
  start.addEventListener("click", () => {
    message.textContent = "";
    // 最初のラウンドの前だけ, メンバーを確かめさせる. 始めると途中参加できないため.
    // 2 ラウンド目以降はメンバーが変わらないので, すぐ始める.
    if (match.rounds.length === 0) {
      void getMatch(match.id).then((result) => {
        if (!result.ok) {
          message.textContent = result.error;
          return;
        }
        openStartRoundDialog(root, result.value, membership);
      });
      return;
    }
    start.disabled = true;
    void startRound(match.id, membership.token, match.players.length).then(
      (result) => {
        if (!result.ok) {
          message.textContent = result.error;
          start.disabled = false;
          return;
        }
        void renderMatchPage(root, match.id);
      },
    );
  });
  return element("section", {}, [
    element("h2", { text: "リーダーの操作" }),
    start,
    message,
  ]);
}

// 最初のラウンドを始める前の確認. 最新のメンバーを見せ, 途中参加できないことを伝える.
function openStartRoundDialog(
  root: HTMLElement,
  latest: MatchView,
  membership: Membership,
): void {
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const confirm = element("button", { text: "始める" });
  const cancel = element("button", { text: "やめる" });
  const members = latest.players.map((player) =>
    element("li", { text: player.name }),
  );
  const dialog = element("dialog", {}, [
    element("h3", { text: "このメンバーで始めますか" }),
    element("p", {
      text: `参加しているのは ${String(latest.players.length)} 人です.`,
    }),
    element("ul", {}, members),
    element("p", {
      className: "warning",
      text: "始めると, これ以上だれも参加できません. 足りない人がいれば, やめて参加を待ってください.",
    }),
    element("div", { className: "dialog-buttons" }, [cancel, confirm]),
    message,
  ]);
  dialog.addEventListener("close", () => {
    dialog.remove();
  });
  cancel.addEventListener("click", () => {
    dialog.close();
  });
  confirm.addEventListener("click", () => {
    confirm.disabled = true;
    message.textContent = "";
    // 確かめた人数を送る. 確かめている間に誰かが参加していたら, サーバーが拒否する.
    void startRound(latest.id, membership.token, latest.players.length).then(
      (result) => {
        if (!result.ok) {
          message.textContent = result.error;
          confirm.disabled = false;
          return;
        }
        dialog.close();
        void renderMatchPage(root, latest.id);
      },
    );
  });
  document.body.append(dialog);
  dialog.showModal();
}

// リーダーにだけ出す, マッチを削除する欄. 権限の確認はサーバーでも毎回行う.
function renderDeleteSection(
  match: MatchView,
  membership: Membership,
): HTMLElement {
  const open = element("button", {
    className: "danger",
    text: "マッチを削除する",
  });
  open.addEventListener("click", () => {
    openDeleteMatchDialog(match, membership);
  });
  return element("section", { className: "delete-section" }, [
    element("h2", { text: "マッチの削除" }),
    open,
  ]);
}

// 削除の前の確認. 全員の結果が消え, 元に戻せないことを伝える.
function openDeleteMatchDialog(match: MatchView, membership: Membership): void {
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const confirm = element("button", { className: "danger", text: "削除する" });
  const cancel = element("button", { text: "やめる" });
  const dialog = element("dialog", {}, [
    element("h3", { text: `「${match.name}」を削除しますか` }),
    element("p", {
      className: "warning",
      text: "全員の持ち点と累計が消え, 元に戻せません. 参加している人も, このマッチを開けなくなります.",
    }),
    element("div", { className: "dialog-buttons" }, [cancel, confirm]),
    message,
  ]);
  dialog.addEventListener("close", () => {
    dialog.remove();
  });
  cancel.addEventListener("click", () => {
    dialog.close();
  });
  confirm.addEventListener("click", () => {
    confirm.disabled = true;
    message.textContent = "";
    void deleteMatch(match.id, membership.token).then((result) => {
      if (!result.ok) {
        message.textContent = result.error;
        confirm.disabled = false;
        return;
      }
      // 消したマッチには戻る意味がないので, トークンも消してトップページに戻る.
      removeMembership(match.id);
      location.assign("/");
    });
  });
  document.body.append(dialog);
  dialog.showModal();
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
  const url = location.href;
  const copy = element("button", { text: "URL をコピー" });
  const message = element("p", { attributes: { role: "status" } });
  copy.addEventListener("click", () => {
    message.textContent = "";
    message.className = "";
    void copyText(url).then((isCopied) => {
      if (isCopied) {
        message.textContent = "コピーしました.";
        return;
      }
      message.className = "error";
      message.textContent =
        "コピーできませんでした. 上の欄の URL を選んでコピーしてください.";
    });
  });
  return element("section", {}, [
    element("h2", { text: "仲間を呼ぶ" }),
    element("p", { text: "この URL を送ると, 仲間が参加できます." }),
    element("p", {
      className: "warning",
      text: "最初のラウンドが始まると, 参加できなくなります.",
    }),
    element("input", {
      className: "share-url",
      attributes: { readonly: "", value: url },
    }),
    copy,
    message,
  ]);
}

// 文字をコピーする. ブラウザが許さない (https でない, 権限がないなど) ときは false.
async function copyText(text: string): Promise<boolean> {
  // アプリの中では, WebView でブラウザのコピーの機能が確実には動かないので, アプリに頼む.
  if (copyTextInApp(text)) {
    return true;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderPlayersSection(
  match: MatchView,
  membership: Membership | null,
  onChanged: () => void,
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
  const section = element("section", {}, [
    element("h2", { text: `プレイヤー (${String(match.players.length)} 人)` }),
    element("ul", {}, items),
  ]);
  const self = match.players.find(
    (player) => player.id === membership?.playerId,
  );
  if (membership !== null && self !== undefined) {
    section.append(
      renderRenameForm(match.id, self.name, membership, onChanged),
    );
  }
  return section;
}

// 自分の名前を変える欄. 本人ならいつでも変えられる.
function renderRenameForm(
  matchId: string,
  currentName: string,
  membership: Membership,
  onChanged: () => void,
): HTMLElement {
  const name = element("input", {
    attributes: { required: "", maxlength: String(MAX_PLAYER_NAME_LENGTH) },
  });
  name.value = currentName;
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "名前を変える",
    attributes: { type: "submit" },
  });
  const form = element("form", { className: "rename-form" }, [
    labeledField("あなたの名前", name),
    submit,
    message,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    void renamePlayer(
      matchId,
      membership.playerId,
      name.value,
      membership.token,
    ).then((result) => {
      if (!result.ok) {
        message.textContent = result.error;
        submit.disabled = false;
        return;
      }
      onChanged();
    });
  });
  return element("details", {}, [
    element("summary", { text: "名前を変える" }),
    form,
  ]);
}

// 累計. 確定したラウンドだけの増減の和で, API が計算したものをそのまま出す.
function renderTotalsSection(match: MatchView): HTMLElement {
  const namesById = new Map(
    match.players.map((player) => [player.id, player.name]),
  );
  const rows = match.totals.map((total) =>
    element("tr", {}, [
      element("td", { text: namesById.get(total.playerId) ?? "" }),
      element("td", { text: formatDelta(total.total) }),
    ]),
  );
  return element("section", {}, [
    element("h2", { text: "累計" }),
    element("p", { text: "確定したラウンドだけを足しています." }),
    element("table", {}, [
      element("thead", {}, [
        element("tr", {}, [
          element("th", { text: "名前" }),
          element("th", { text: "累計" }),
        ]),
      ]),
      element("tbody", {}, rows),
    ]),
  ]);
}
