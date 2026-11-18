import {
  CHIP_COLORS,
  chipValuesFromRecord,
  toChipValuesRecord,
  type ChipValues,
} from "../../rules/chip-values";
import { updateChipValues, type MatchView } from "../api";
import { createChipValueFields } from "../chip-values-fields";
import { element } from "../dom";
import type { Membership } from "../membership";
import { formatPoints } from "../result-views";

/**
 * マッチの色ごとの点数を出す. 全員に見せ, リーダーには変える欄も出す.
 *
 * チップから入力するときに換算に使う点数を, 全員が確かめられるようにするため (docs/web/app.md).
 * @param match マッチ.
 * @param membership このブラウザのプレイヤー. 参加していなければ null.
 * @param onChanged 点数を変えたあとに呼ぶ. 画面を読み直すため.
 * @returns section 要素.
 */
export function renderChipValuesSection(
  match: MatchView,
  membership: Membership | null,
  onChanged: () => void,
): HTMLElement {
  const values = chipValuesFromRecord(match.chipValues);
  const section = element("section", {}, [
    element("h2", { text: "チップの点数" }),
    renderChipValuesList(values),
  ]);
  // 権限の確認はサーバーでも毎回行う. ここで隠すのは, 変えられない人に見せないためだけ.
  if (membership !== null && membership.playerId === match.leaderPlayerId) {
    section.append(
      renderUpdateForm(match.id, values, membership.token, onChanged),
    );
  }
  return section;
}

// 決めた色だけを, 色の一覧の順に出す. 決めていなければ, その旨を出す.
function renderChipValuesList(values: ChipValues): HTMLElement {
  if (values.size === 0) {
    return element("p", {
      text: "まだ決まっていません. リーダーが決めると, チップから入力できます.",
    });
  }
  const rows = CHIP_COLORS.flatMap((color) => {
    const points = values.get(color.name);
    if (points === undefined) {
      return [];
    }
    const swatch = element("span", { className: "chip-swatch" });
    swatch.style.backgroundColor = color.swatch;
    return [
      element("li", { className: "chip-value-row" }, [
        swatch,
        element("span", { className: "chip-value-label", text: color.label }),
        element("span", { text: `${formatPoints(points)} 点` }),
      ]),
    ];
  });
  return element("ul", { className: "chip-values-list" }, rows);
}

// リーダーが点数を変える欄. 今の点数を入れた状態で出し, 保存したら画面を読み直す.
function renderUpdateForm(
  matchId: string,
  values: ChipValues,
  token: string,
  onChanged: () => void,
): HTMLElement {
  const fields = createChipValueFields(values);
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "点数を保存する",
    attributes: { type: "submit" },
  });
  const form = element("form", {}, [
    // 保存するのは持ち点だけで, 点数は換算に使うだけのため (docs/web/app.md).
    element("p", {
      text: "変えても, もう保存した持ち点は変わりません. これからチップから入力するときに使います.",
    }),
    fields.container,
    submit,
    message,
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    message.textContent = "";
    const newValues = fields.read();
    if (newValues === null) {
      return;
    }
    submit.disabled = true;
    void updateChipValues(matchId, toChipValuesRecord(newValues), token).then(
      (result) => {
        if (!result.ok) {
          message.textContent = result.error;
          submit.disabled = false;
          return;
        }
        onChanged();
      },
    );
  });
  return element("details", {}, [
    element("summary", { text: "点数を変える" }),
    form,
  ]);
}
