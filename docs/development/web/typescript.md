# Web アプリの TypeScript の書き方

Web アプリ (`web/`) の TypeScript に固有の書き方をまとめる.
言語によらない規則は [code-rules.md](../code-rules.md) に, 層の分け方は [layers.md](layers.md) にある.

## 技術

| 役割 | 使うもの |
|---|---|
| 言語 | TypeScript (strict) |
| 実行環境 | Node 24 (開発), Cloudflare Workers (本番) |
| API | Hono |
| DB | Cloudflare D1 (SQLite) |
| 入力の検証 | zod |
| 画面 | フレームワークなし. Vite でビルドし, Workers の Static Assets で配る |
| チップの検出 | core を Emscripten で WASM にしたもの (`wasm/`). 画面から呼ぶ |
| テスト | Vitest と `@cloudflare/vitest-plugin` (workerd とローカルの D1 で動かす) |
| 整形・lint | Prettier, ESLint (typescript-eslint) |

## ディレクトリ

| 場所 | 層 | 中身 |
|---|---|---|
| `web/src/rules/` | 規則 | 純粋な関数と, 上限などの定数. DB・HTTP・画面に触れない |
| `web/src/server/api/` | API | 入力の検証, 権限の確認, 規則と DB アクセスの呼び出し, 応答の形 |
| `web/src/server/db/` | DB アクセス | SQL はここにだけ書く |
| `web/src/server/index.ts` | | Worker の入口. API をつなぐ |
| `web/src/client/` | 画面 | HTML と, API を呼んで表示する処理. チップの検出 (WASM の core を呼ぶ) |
| `web/src/client/public/detector/` | | WASM とモデル. `scripts/build_wasm.sh` が置くビルドの結果で, git にも整形と lint にも入れない |
| `web/migrations/` | | D1 の表の定義. 番号の順に当てる |
| `web/test/` | | テスト |

画面 (`src/client/`) は DOM の型で, それ以外は Workers の型で検査する. そのため `src/client/` に別の `tsconfig.json` がある.

## 検査

`web/` で次を流す. コミットの前に必ず通す.

```sh
npm run check    # 整形の確認, lint, 型検査, 全テスト, npm audit
npm run format   # 整形する
npm run dev      # 画面をビルドし, ローカルの D1 に migrations を当てて wrangler dev を起動する (検出器は作り直さない)
```

手元でサーバーを立てるときは, リポジトリのルートで `make web-dev` (LAN から開くなら `make web-dev-lan`) を使う.
起動の前に検出器を作り直すので, core を変えたあとも古い検出器で動かない ([running.md](../../web/running.md)).

`npm audit` は 2 回流す. 検査を止めるのは本番の依存 (`dependencies`. Worker で動く hono と zod) の脆弱性だけにし (`--omit=dev`),
開発の道具 (`devDependencies`. vite, vitest, eslint など) を含めた全体は表示するだけにする (`--audit-level=none`).
開発の道具は手元と CI で自分のファイルを扱うだけで本番では動かず, 直った版が出るまで Web のコミットとデプロイが止まるのを避けるため.
表示に開発の道具の脆弱性が出ていたら, 直った版が出たときに上げる.

チップを検出するには, 先にリポジトリのルートで `make setup` を流しておく. core やモデルを変えたら, `make web-dev` で起動し直すか `scripts/build_wasm.sh` で作り直す ([running.md](../../web/running.md)).

Node は `~/.local/node` に入っている. PATH が通っていないシェルでは `export PATH="$HOME/.local/node/bin:$PATH"` を先に実行する.
Node の入れ方は [../../environment/setup.md](../../environment/setup.md) に, 起動の手順は [running.md](../../web/running.md) にある.

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
- 例外として, チップの検出の結果から持ち点を求める換算は, 画面が規則 (`src/rules/`) を呼んで行う.
  換算はバックエンドに置かない仕様 ([app.md](../../web/app.md)) のため. 求めた持ち点は入力欄に入れるだけで, 送るときに API が検証する.
- WASM から返る値は外からの入力として扱い, zod で検証してから使う. core と画面の版がずれたときに, 黙って間違った値を出さないため.
