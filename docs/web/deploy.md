# 本番へのデプロイ

点数計算アプリ (`web/`) を本番 (Cloudflare Workers の無料プラン) に出す手順と, モデルの替え方, 戻し方をまとめる.
仕組みとそう決めた理由は [../architecture.md](../architecture.md) の「11. デプロイは GitHub Actions で行い, 検出器もそこでビルドする」にある.
手元での起動は [running.md](running.md) にある.

## だれが何をするか

| 操作 | 行う人 | どこで |
|---|---|---|
| main への push (これがデプロイになる) | 人. AI は人に push をはっきり指示されたときだけ | 手元の `git push` |
| 本番の D1 に migration を当てる | 人だけ | GitHub の Actions → migrate → Run workflow |
| モデルの Release を作る (モデルを替えるときだけ) | 人. AI は人に指示されたときだけ | 手元の `scripts/release_model.sh` |
| 手元から本番に触る (`wrangler rollback` など) | 人. AI は人に指示されたときだけ | 手元 (期限付きのトークンを渡す) |

AI は人に push をはっきり指示されたときだけ push するので, AI がそれ以外でデプロイすることはない ([../development/security.md](../development/security.md)).

手元の `wrangler` には Cloudflare のログイン (`wrangler login`) をしない. Cloudflare の操作は画面で行い, 本番に触るのは CI だけにする.
手元に本番の権限を残さないため.

## 最初の 1 回

Cloudflare の画面の文言は英語の表示で書く. ブラウザによっては日本語で表示され, 時期によって配置も変わる.

### 1. Cloudflare のアカウントを作る

1. https://dash.cloudflare.com/sign-up を開き, メールアドレスとパスワードで登録する. 届いたメールの確認リンクを押す.
   2 回目からは https://dash.cloudflare.com/login から入る.
2. 何に使うかの質問やドメインを追加する案内は, 飛ばしてよい (ドメインは使わない).
   プランは何もしなければ無料 (Free) で, クレジットカードは要らない.
3. 右上の人のアイコン → My Profile → Authentication で, 2 段階認証を有効にする. 本番の DB を持つアカウントのため.

### 2. workers.dev のサブドメインを確かめる

1. 左のメニューの Compute (Workers) → Workers & Pages を開く. アプリを作る案内が出ても, 何も作らない (デプロイは CI が行う).
2. 右側の Account Details の Subdomain (`<サブドメイン>.workers.dev`) を見る.
3. 公開の URL (`https://pokerchip-score.<サブドメイン>.workers.dev`) になるので, メールアドレスの一部など個人が分かる名前なら, 横の Change で変える.

### 3. アカウントの ID を控える

同じ Account Details の Account ID を, 横のボタンで写す (画面の上の検索 Ctrl + K の「Copy account ID」でもよい). 6 で使う.

### 4. D1 を作る

1. 左のメニューの Storage & databases → D1 SQL database → Create Database.
2. Name は `pokerchip-score` (`web/wrangler.toml` の `database_name` と同じにする). Location を選べるなら Asia-Pacific. Jurisdiction は触らない.
3. Create を押し, 表示される Database ID を `web/wrangler.toml` の `database_id` に入れてコミットする. 秘密ではない.

本番の D1 は作ってあり, id は `web/wrangler.toml` に入っている. 作り直したときだけ, この手順で id を替える.

### 5. CI 用の API トークンを作る

トークンは秘密. 6 で GitHub に入れる以外の場所 (メモ, チャット, AI) に出さない.

1. 右上の人のアイコン → My Profile → API Tokens (https://dash.cloudflare.com/profile/api-tokens) → Create Token.
2. Token name: `pokerchip-github-actions` など, 用途が分かる名前.
3. Policies: 一番上の Start from scratch → Start with an Account policy を選ぶ.
   テンプレート (Edit Cloudflare Workers など) は使わない. 要らない権限 (KV, R2, ルートの変更など) が付くため.
4. Account policy の中身:
   - 対象のアカウント: 自分のアカウントだけ. All accounts にしない.
   - 権限: Workers Scripts の Edit と, D1 の Edit の 2 つだけ. Workers KV Storage, Workers Routes など似た名前のものは付けない.
   - 1 つの policy に権限を 1 つしか入れられない画面なら, Account policy をもう 1 つ足して入れる.
5. Token expiration: No expiration. 期限が切れると CI のデプロイが止まるため. 漏れたときは消して作り直す.
6. Client IP address filtering: 空のまま. GitHub Actions は毎回違う IP から動くため.
7. Continue to summary → 権限が上の 2 つだけかを確かめる → Create Token.
8. トークンは一度だけ表示される. コピーし, 画面を閉じずに 6 に進む.

### 6. GitHub に Secrets を登録する

1. https://github.com/akisatoon1/pokerchipsDetection/settings/secrets/actions を開く
   (リポジトリの Settings → Secrets and variables → Actions).
2. New repository secret で, 次の 2 つを登録する. 名前は大文字とアンダースコアまで同じにする.

   | Name | Secret |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | 5 のトークン |
   | `CLOUDFLARE_ACCOUNT_ID` | 3 の Account ID |

3. Repository secrets に 2 つ並んだら, Cloudflare のトークンの画面を閉じる.

### 7. モデルの Release を作る

下の「モデルを替える」のとおり. `models/model.lock` ができるので, コミットする.

### 8. 最初のデプロイ

1. push の前に, スキル `pre-push-check` で上げてはいけないものがないかを調べる ([../development/security.md](../development/security.md)).
2. push する. GitHub の Actions → deploy が動き, 「本番の D1 に未適用の migration があります」で止まる (本番の D1 はまだ空のため).
3. Actions → migrate → Run workflow → Run workflow で migration を当てる.
   migrate は push して GitHub に載ってから起動できる. ログの最初に, 当てる前の戻し先 (Time Travel の bookmark) が出る.
4. Actions で止まった deploy の実行を開き, Re-run jobs → Re-run failed jobs で再実行する.
5. 最後の手順「デプロイする」のログに出る URL (`https://pokerchip-score.<サブドメイン>.workers.dev`) を開き, 次を確かめる.
   - マッチを作る. 別のブラウザ (またはスマートフォン) で参加する. ラウンドを始め, 持ち点を入れて確定する.
   - `/count` で写真からチップを検出する.

最初のデプロイが権限のエラー (Worker を作れない) で止まったら, 下の「手元から本番に触るとき」の形で, 1 回だけ手元から
`npm run build && npx wrangler deploy` を流して Worker を作る. Worker を新しく作るには 5 のトークンより強い権限が要ることがあるため.
2 回目からは CI でデプロイできる.

## モデルを替える

デプロイの CI は, 検出器 (core を WASM にしたものとモデル) を毎回ビルドする. core, `wasm/`, 画面, API の変更は,
push すれば CI がビルドしてデプロイするので, 人がすることはない.

人が手で行うのは, モデルを替えるときだけ. モデル (ONNX, 約 10MB) は重いので git に入れず, GitHub Release に置く.
どの Release のモデルを使うかは `models/model.lock` (タグと sha256) に書き, これを git に入れる.

### 前提

- 新しい重み (`.pt`) を ONNX に書き出してある (`scripts/export_model.sh <best.pt>`. [../logic/usage.md](../logic/usage.md)).
- 手元の全体テストで試し, このモデルを使うと決めてある.
- GitHub CLI (`gh`) が入っていて, ログインしてある. `gh auth status` で `Logged in to github.com` と出ればよい.

### 手順

リポジトリのルートで流す.

```sh
scripts/release_model.sh         # Release を作り, models/model.lock を書き換える
scripts/fetch_model.sh           # 作った Release から取ってきて, sha256 が合うかを確かめる (CI と同じ処理)
git add models/model.lock
git commit -m "chore: モデルを <タグ> にする"
```

push すると, 次のデプロイでそのモデルが出る.

### `release_model.sh` がすること

1. `models/chip_detector.onnx` の sha256 を求め, タグを `model-<sha256 の先頭 12 文字>` にする.
2. そのタグの Release がなければ作り, モデルを上げる. 説明にはモデルの sha256 を書く.
   あれば, 中身は同じなので置き直さない. 同じモデルを二重に置かないため.
3. `models/model.lock` にタグと sha256 を書く.

- Release は公開される. 置くのは, デプロイしたサイトから誰でも取れるモデルと同じファイルだけ.
- 古い Release は消さない. `models/model.lock` を前のコミットに戻せば, 前のモデルでデプロイし直せるようにするため.

### Emscripten や OpenCV の版, `wasm/` の設定を変えたとき

CI は検出器をビルドするだけで, Linux の CLI と結果が同じかは確かめない. ビルドの道具が変わると WASM の結果がずれうるので,
push の前に手元で比べる. core やモデルを変えただけでは, 同じソースとモデルを使うのでずれない.

```sh
make build && scripts/build_wasm.sh && functional_tests/compare_wasm_cli.sh
```

`compare_wasm_cli.sh` は `testimages/v2/yoko/` の画像を WASM と CLI で解析し, 結果が同じかを確かめる (1 分ほど).

## ふだんの流れ

本番に出るものの元が変わったコミットを push すると, デプロイされる. 元とは, `web/` と, 検出器の元
(`core/`, `wasm/`, `models/model.lock`, 検出器を作るスクリプト) のこと. 一覧は `.github/workflows/deploy.yml` の `paths` にある.
文書, Android, テストだけのコミットではデプロイされない.

deploy は次の順に進み, どこかで失敗したらデプロイしない.

1. モデルを `models/model.lock` の Release から取り, sha256 を確かめる.
2. Emscripten と WASM 用の OpenCV をキャッシュから戻す. なければ取ってきてビルドする (OpenCV のビルドで時間がかかる).
3. 検出器 (core + wasm + モデル) をビルドする.
4. `npm run check` (整形, lint, 型検査, テスト, `npm audit`).
5. 本番の D1 に未適用の migration がないかを確かめる.
6. 画面をビルドし, `wrangler deploy` する.

Emscripten と OpenCV のキャッシュは, 用意するスクリプト (`fetch_emsdk.sh`, `fetch_opencv_source.sh`, `build_opencv_wasm.sh`) を
変えると作り直す. 7 日使わないと GitHub が消すので, そのあとの 1 回は遅くなる.

## migration を足したとき

1. migration (`web/migrations/`) を足したコミットを push する. deploy は「未適用の migration があります」で止まる.
2. Actions → migrate → Run workflow で当てる. ログの最初に出る bookmark は, 戻すときに使う.
3. 止まった deploy を再実行する.

migration は, 古いコードのまま当てても壊れない形 (表や列を足すだけ) にする. 消す・名前を変えるときは, コードを先に出してから別の migration で消す.

## 手元から本番に触るとき

戻すときや, 最初のデプロイを手元で行うときだけ, 期限付き (例: 1 日) の API トークンを画面で別に作り, 環境変数で渡す.
権限は, 行う操作に要るものだけにする. 使い終わったら画面で消す. CI 用のトークンを手元に写して使い回さない.

```sh
cd web
export CLOUDFLARE_API_TOKEN=<そのときだけのトークン>
export CLOUDFLARE_ACCOUNT_ID=<アカウントの id>
npx wrangler rollback              # 例
```

## 戻し方

- **コード**: 前のコミットに戻すコミット (`git revert`) を作って push する.
  急ぐときは「手元から本番に触るとき」の形で `npx wrangler rollback` (直前の版に戻す) を流す. ただし次の push で main の内容が出る.
- **モデル**: `models/model.lock` を前の内容に戻すコミットを作って push する. core などの検出器の元は, コードと同じく `git revert` で戻す.
- **DB**: migrate のログに出た bookmark で, 当てる前に戻す. 無料プランで戻せるのは 7 日前まで.
  戻した時点より後に入った持ち点などは消えるので, 人が判断してから行う.

  ```sh
  cd web
  npx wrangler d1 time-travel restore DB --bookmark=<bookmark>
  ```

## 本番のログ

Cloudflare の画面の Workers & Pages → pokerchip-score → Logs で見る (Workers Logs. 無料プランでは 3 日分).
画面に「サーバーで問題が起きました」と出たら, ここにエラーの名前と内容が出る (トークンは出さない).

## うまくいかないとき

| 出たこと | 原因と直し方 |
|---|---|
| deploy が「本番の D1 に未適用の migration があります」で止まる | migrate を起動してから, deploy を再実行する |
| 「models/model.lock がありません」 | モデルの Release をまだ作っていない. 上の「モデルを替える」 |
| 「モデルの sha256 が models/model.lock と合いません」 | Release のファイルが書き換わった. `release_model.sh` で Release を作り直す |
| 「emsdk のタグ … のコミットが … ではありません」 | emsdk のタグが差し替えられた. 何が変わったかを確かめてから, `fetch_emsdk.sh` の版とコミットを直す |
| 「OpenCV … の tarball の sha256 が合いません」 | 取ったソースが前と違う. 何が変わったかを確かめるまで, ビルドしない |
| 検出器のビルドが時間切れで止まる | Emscripten と OpenCV のキャッシュがなく, ビルドに時間がかかった. 失敗した実行ではキャッシュが保存されないので, `deploy.yml` の `timeout-minutes` を延ばしてから再実行する |
| `CLOUDFLARE_API_TOKEN` がないという旨のエラー, 認証のエラー | GitHub の Secrets の名前の綴りと, トークンの権限 (Workers Scripts と D1 の Edit) を確かめる |
| 最初のデプロイで Worker を作れない | 上の「8. 最初のデプロイ」の最後のとおり, 手元から 1 回だけデプロイする |
| deploy が動かない | 変えたファイルが `deploy.yml` の `paths` に入っているか. 文書だけの push では動かない |
