import { MAX_POINTS } from "../../rules/limits";
import { putEntry, type MatchView, type RoundView } from "../api";
import { element, labeledField } from "../dom";
import type { Membership } from "../membership";

/**
 * ラウンドの一覧を出す. 新しいラウンドを上に出す.
 *
 * 入力中のラウンドがいちばん見たいものなので, 上に置く.
 * @param match マッチ.
 * @param membership このブラウザのプレイヤー. 参加していなければ null.
 * @param onChanged 持ち点を保存したあとに呼ぶ. 画面を読み直すため.
 * @returns section 要素.
 */
export function renderRoundsSection(
  match: MatchView,
  membership: Membership | null,
  onChanged: () => void,
): HTMLElement {
  const section = element("section", {}, [element("h2", { text: "ラウンド" })]);
  if (match.rounds.length === 0) {
    section.append(element("p", { text: "まだラウンドはありません." }));
    return section;
  }
  const namesById = new Map(
    match.players.map((player) => [player.id, player.name]),
  );
  for (const round of [...match.rounds].reverse()) {
    section.append(renderRound(round, namesById, membership, onChanged));
  }
  return section;
}

function renderRound(
  round: RoundView,
  namesById: ReadonlyMap<string, string>,
  membership: Membership | null,
  onChanged: () => void,
): HTMLElement {
  const isOpen = round.status === "open";
  const children: HTMLElement[] = [
    element("h3", {
      text: `ラウンド ${String(round.number)} (${isOpen ? "入力中" : "確定"})`,
    }),
  ];
  if (isOpen && membership !== null) {
    children.push(renderEntryForm(round, membership, onChanged));
  }
  children.push(renderScoreTable(round, namesById));
  if (round.hasTotalMismatch) {
    children.push(
      element("p", {
        className: "warning",
        text: `持ち点の合計 ${String(round.totalPoints)} が, 初期点数 × 人数 = ${String(round.expectedTotalPoints)} と合いません.`,
      }),
    );
  }
  return element("article", { className: "round" }, children);
}

/**
 * 持ち点と増減の表を作る.
 *
 * @param round ラウンド.
 * @param namesById プレイヤーの id から名前を引く表.
 * @returns table 要素.
 */
export function renderScoreTable(
  round: RoundView,
  namesById: ReadonlyMap<string, string>,
): HTMLTableElement {
  const rows = round.scores.map((score) =>
    element("tr", {}, [
      element("td", { text: namesById.get(score.playerId) ?? "" }),
      element("td", {
        text: score.points === null ? "未入力" : String(score.points),
      }),
      element("td", {
        text: score.delta === null ? "" : formatDelta(score.delta),
      }),
    ]),
  );
  return element("table", {}, [
    element("thead", {}, [
      element("tr", {}, [
        element("th", { text: "名前" }),
        element("th", { text: "持ち点" }),
        element("th", { text: "増減" }),
      ]),
    ]),
    element("tbody", {}, rows),
  ]);
}

/**
 * 増減を符号つきで書く. 0 には符号を付けない.
 *
 * @param delta 増減.
 * @returns "+50", "−100", "0" のような文字.
 */
export function formatDelta(delta: number): string {
  if (delta > 0) {
    return `+${String(delta)}`;
  }
  if (delta < 0) {
    return `−${String(-delta)}`;
  }
  return "0";
}

function renderEntryForm(
  round: RoundView,
  membership: Membership,
  onChanged: () => void,
): HTMLFormElement {
  const current = round.scores.find(
    (score) => score.playerId === membership.playerId,
  );
  const points = element("input", {
    attributes: {
      type: "number",
      required: "",
      min: "0",
      max: String(MAX_POINTS),
      step: "1",
      inputmode: "numeric",
    },
  });
  if (current !== undefined && current.points !== null) {
    points.value = String(current.points);
  }
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "保存する",
    attributes: { type: "submit" },
  });
  const form = element("form", { className: "entry-form" }, [
    labeledField("あなたの持ち点", points),
    submit,
    message,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    void putEntry(
      round.id,
      membership.playerId,
      points.valueAsNumber,
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
  return form;
}
