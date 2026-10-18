/**
 * 規則の判定の結果.
 *
 * 利用者の入力が決まりを満たさないことは例外ではなく, この形で返す.
 * 呼ぶ側が失敗を必ず扱うようにするため. reason は利用者に見せてよい短い説明.
 */
export type RuleResult<T> =
  { ok: true; value: T } | { ok: false; reason: string };
