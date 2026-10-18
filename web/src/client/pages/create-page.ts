import {
  MAX_MATCH_NAME_LENGTH,
  MAX_PLAYER_NAME_LENGTH,
  MAX_POINTS,
} from "../../rules/limits";
import { createMatch } from "../api";
import { element, labeledField } from "../dom";
import { saveMembership } from "../membership";

/**
 * マッチを作る画面を出す.
 *
 * 作ったらトークンを保存し, マッチの画面に移る.
 * @param root 画面を入れる要素.
 */
export function renderCreatePage(root: HTMLElement): void {
  const matchName = element("input", {
    attributes: { required: "", maxlength: String(MAX_MATCH_NAME_LENGTH) },
  });
  const initialPoints = element("input", {
    attributes: {
      type: "number",
      required: "",
      min: "1",
      max: String(MAX_POINTS),
      step: "1",
      inputmode: "numeric",
    },
  });
  const leaderName = element("input", {
    attributes: { required: "", maxlength: String(MAX_PLAYER_NAME_LENGTH) },
  });
  const message = element("p", {
    className: "error",
    attributes: { role: "alert" },
  });
  const submit = element("button", {
    text: "マッチを作る",
    attributes: { type: "submit" },
  });

  const form = element("form", {}, [
    labeledField("マッチ名", matchName),
    labeledField("初期点数", initialPoints),
    labeledField("あなたの名前", leaderName),
    submit,
    message,
  ]);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit.disabled = true;
    message.textContent = "";
    void createMatch({
      matchName: matchName.value,
      initialPoints: initialPoints.valueAsNumber,
      leaderName: leaderName.value,
    }).then((result) => {
      if (!result.ok) {
        message.textContent = result.error;
        submit.disabled = false;
        return;
      }
      const { matchId, playerId, token } = result.value;
      try {
        saveMembership(matchId, { playerId, token });
      } catch {
        message.textContent =
          "このブラウザに保存できませんでした. プライベートモードを外してやり直してください";
        submit.disabled = false;
        return;
      }
      location.assign(`/m/${matchId}`);
    });
  });

  root.replaceChildren(
    element("h1", { text: "点数計算" }),
    element("p", { text: "マッチを作り, URL を仲間に送ってください." }),
    form,
  );
}
