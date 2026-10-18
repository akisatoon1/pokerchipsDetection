// 値の範囲と上限. docs/web/app.md と docs/web/scoring.md の決まりを, ここ 1 か所に置く.

/** プレイヤーの名前の最大の文字数. */
export const MAX_PLAYER_NAME_LENGTH = 20;

/** マッチ名の最大の文字数. */
export const MAX_MATCH_NAME_LENGTH = 40;

/**
 * 初期点数 S と持ち点 p の上限.
 *
 * 10 人分の合計 (S × n や Σp) でも, JavaScript の数で誤差なく扱える大きさにしてある.
 */
export const MAX_POINTS = 1_000_000_000;

/** 1 つのマッチのプレイヤーの上限. 公開された URL で大量に参加されないようにするため. */
export const MAX_PLAYERS = 10;

/** ラウンドを始めるのに要るプレイヤーの数. 1 人では点数のやり取りが起きないため. */
export const MIN_PLAYERS_TO_START_ROUND = 2;
