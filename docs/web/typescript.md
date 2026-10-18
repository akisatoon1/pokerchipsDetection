# Web アプリの TypeScript の書き方

Web アプリ (`web/`) の TypeScript に固有の書き方をまとめる.
言語によらない規則は [code-rules.md](code-rules.md) にある.

## 技術

| 役割 | 使うもの |
|---|---|
| 言語 | TypeScript (strict) |
| 実行環境 | Node 24 (開発), Cloudflare Workers (本番) |
| API | Hono |
| DB | Cloudflare D1 (SQLite) |
| 入力の検証 | zod |
| 画面 | フレームワークなし. Vite でビルドし, Workers の Static Assets で配る |
| テスト | Vitest と `@cloudflare/vitest-plugin` (workerd とローカルの D1 で動かす) |
| 整形・lint | Prettier, ESLint (typescript-eslint) |

## ディレクトリ

| 場所 | 層 | 中身 |
|---|---|---|
| `web/src/rules/` | 規則 | 純粋な関数と, 上限などの定数. DB・HTTP・画面に触れない |
| `web/src/server/api/` | API | 入力の検証, 権限の確認, 規則と DB アクセスの呼び出し, 応答の形 |
| `web/src/server/db/` | DB アクセス | SQL はここにだけ書く |
| `web/src/server/index.ts` | | Worker の入口. API をつなぐ |
| `web/src/client/` | 画面 | HTML と, API を呼んで表示する処理 |
| `web/migrations/` | | D1 の表の定義. 番号の順に当てる |
| `web/test/` | | テスト |

画面 (`src/client/`) は DOM の型で, それ以外は Workers の型で検査する. そのため `src/client/` に別の `tsconfig.json` がある.

## 検査

`web/` で次を流す. コミットの前に必ず通す.

```sh
npm run check    # 整形の確認, lint, 型検査, 全テスト, npm audit
npm run format   # 整形する
npm run dev      # 画面をビルドし, ローカルの D1 に migrations を当てて wrangler dev を起動する
```

Node は `~/.local/node` に入っている. PATH が通っていないシェルでは `export PATH="$HOME/.local/node/bin:$PATH"` を先に実行する.
Node の入れ方と起動の手順は [running.md](running.md) にある.

## 書き方

### 名前

- ファイル名は kebab-case (`match-page.ts`).
- 関数と変数は camelCase, 型は PascalCase, モジュールの外側に置く定数は UPPER_SNAKE_CASE (`MAX_PLAYERS`).

### コメント

- export する関数・型・定数には `/** */` のコメントを付け, 役割, 引数, 戻り値, 失敗したときの振る舞いを書く.
- 理由は `//` のコメントで書く. 仕様に由来するコードには, その仕様を書く.

### 型と検証

- `any` と型の断定 (`as`) は使わない. 外から来る値は zod で検証してから型を付ける.
- zod のスキーマは `.strict()` にし, 知らない項目を拒否する.
- 名前の決まりなどの判定は規則 (`src/rules/`) の関数で行い, zod のスキーマには形 (文字列か, 整数か) だけを書く.

### 失敗の伝え方

- 規則の関数は, 利用者の入力が決まりを満たさないことを例外ではなく戻り値で返す.
  `{ ok: true, value } | { ok: false, reason }` の形にする. 呼ぶ側が失敗を必ず扱うようにするため.
- API は失敗を HTTP のステータスと `{ error: "<利用者向けの短い説明>" }` で返す. 内部の情報は入れない.

### DB アクセス

- 関数は D1 のデータベースを第 1 引数で受け取る. テストで差し替えられるようにするため.
- 値は必ず `prepare(...).bind(...)` で渡す. 文字列の連結で SQL を作らない.

### 画面

- 要素は `document.createElement` で作り, 文字は `textContent` で入れる. `innerHTML` は lint で禁じている.
- 点数の計算はしない. API が返した増減や累計をそのまま表示する.
