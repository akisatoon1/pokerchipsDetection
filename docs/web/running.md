# Web アプリの起動

点数計算の Web アプリ (`web/`) を, 手元の Linux で起動する手順をまとめる.
API, 画面, DB (D1) はすべてローカルで動く. Cloudflare のアカウントは要らない.
本番 (Cloudflare) へのデプロイは, 最後の「デプロイ」にある.

## 1. Node.js を入れる (最初の 1 回)

Node 24 を使う (`web/package.json` の `engines`). 入っていれば飛ばしてよい.

```sh
node --version   # v24.x.x と出れば入っている
```

入っていなければ, 公式の tarball を `~/.local/node` に入れる. sudo は要らない.
`<version>` は https://nodejs.org/dist/latest-v24.x/ にある最新の版 (例: `v24.22.0`) に置き換える.

```sh
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
curl -fsSLO https://nodejs.org/dist/latest-v24.x/node-<version>-linux-x64.tar.xz
grep 'node-<version>-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum -c -   # OK と出ることを確かめる
mkdir -p ~/.local/node
tar -xJf node-<version>-linux-x64.tar.xz -C ~/.local/node --strip-components=1
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.bashrc
```

新しい端末を開くと `node` と `npm` が使える. 今の端末で使うなら `source ~/.bashrc` を実行する.

## 2. 依存を入れる (最初の 1 回と, package.json が変わったとき)

```sh
cd web
npm ci
```

`package-lock.json` のとおりの版が入る. esbuild と workerd のインストール時のスクリプトは,
`package.json` の `allowScripts` で許してあるので, そのまま動く.

## 3. 起動する

```sh
cd web
npm run dev
```

これは次の 3 つを順に行う.

1. 画面を Vite でビルドし, `web/dist/` に出す.
2. ローカルの D1 に, まだ当てていない migrations (`web/migrations/`) を当てる. 確認を聞かれたら `y` で進める.
3. `wrangler dev` で API と画面を起動する.

起動したら, ブラウザで http://localhost:8787 を開く. 止めるときは `Ctrl+C`.
チップを数える画面は http://localhost:8787/count にある.
8787 番のポートが使われているときは `npm run dev -- --port 8788` のように別のポートを指定する.

### チップの検出を使うとき

画面でチップを検出するには, WASM とモデルが `web/src/client/public/detector/` に要る.
ないと, 解析するときに「検出の仕組みを読み込めませんでした」と出る.
リポジトリのルートで `scripts/build_wasm.sh` を流してから `npm run dev` をする.
初めてなら Emscripten と WASM 用の OpenCV の用意も要る ([../environment/setup.md](../environment/setup.md) の 10).

### 試し方

1. http://localhost:8787 でマッチを作る. 作った人がリーダーになる.
2. 出てきた URL を, 別のブラウザかプライベートウィンドウで開いて参加する.
   トークンはブラウザごとに保存されるので, 同じブラウザの同じウィンドウでは 2 人目になれない.
3. リーダーの画面でラウンドを始め, それぞれの画面で持ち点を入れ, リーダーが確定する.

## スマートフォンのブラウザから試す

iPhone の Safari などから, 手元の `npm run dev` を同じ Wi-Fi (LAN) で開く.

1. 外から開けるように起動する.

   ```sh
   cd web
   npm run dev -- --ip 0.0.0.0
   ```

2. PC の住所を確かめる.

   ```sh
   hostname -I   # 最初に出る 192.168.x.x などが PC の住所
   ```

3. スマートフォンを PC と同じ Wi-Fi につなぎ, ブラウザで `http://<PC の住所>:8787/count` を開く.

- `--ip 0.0.0.0` で起動すると, 同じネットワークの誰からでも開ける. 家などの信頼できるネットワークでだけ使う.
- つながらないときは, PC のファイアウォールが 8787 番を通しているかを確かめる.
- 解析の間は, 画面が数秒止まって見えることがある.

## コードを変えたとき

| 変えたもの | すること |
|---|---|
| API (`src/server/`, `src/rules/`) | 何もしなくてよい. `wrangler dev` が読み直す |
| 画面 (`src/client/`) | 別の端末で `npm run build` を実行し, ブラウザを読み直す |
| core, `wasm/`, モデル | リポジトリのルートで `scripts/build_wasm.sh` を実行してから `npm run build` をし, ブラウザを読み直す |
| DB の定義 (`migrations/` に足した) | `Ctrl+C` で止めて, もう一度 `npm run dev` |

## ローカルの DB

ローカルの D1 のデータは `web/.wrangler/state/` にある (git には入らない).
全部消して始め直すときは, 止めてから消し, もう一度起動する.

```sh
rm -rf web/.wrangler/state
```

## 検査

コミットの前に, 整形・lint・型検査・全テスト・`npm audit` をまとめて流す.
テストは起動中のサーバーとは別の, テスト用の D1 で動くので, 起動していてもいなくてもよい.

```sh
cd web
npm run check
```

書き方と検査の詳しいことは [development/web/typescript.md](../development/web/typescript.md) にある.

## うまくいかないとき

- `node: command not found`: PATH が通っていない. `source ~/.bashrc` を実行するか, 新しい端末を開く.
- `Address already in use`: 8787 番を他のものが使っている. 前に起動した `npm run dev` が残っていないか確かめるか, `--port` で別のポートを使う.
- 画面に古い内容が出る: `npm run build` をし直して, ブラウザを読み直す.
- 「サーバーで問題が起きました」と出る: `npm run dev` の端末にエラーが出ている. migrations を当て忘れていないかも確かめる.

## デプロイ

人が main に push すると, GitHub Actions (`.github/workflows/deploy.yml`) が Cloudflare Workers にデプロイする.
仕組みと理由は [architecture.md](../architecture.md) の「11. デプロイ」にある.
push も, migration のワークフローの起動も, 人だけが行う ([development/web/process.md](../development/web/process.md)).

### 最初の 1 回

手元の `wrangler` にはログインしない (`wrangler login` を使わない). Cloudflare の操作は画面で行い, 本番に触るのは CI だけにする.
手元に本番の権限を残さないため.

1. Cloudflare のアカウントを作る (無料プラン).
2. 画面の Workers & Pages を開き, workers.dev のサブドメインを決める.
   URL (`https://pokerchip-score.<サブドメイン>.workers.dev`) として公開されるので, 本名など個人が分かる名前にしない.
3. 画面の Storage & databases → D1 → Create で, 名前を `pokerchip-score` にして D1 を作る.
   表示される Database ID を `web/wrangler.toml` の `database_id` に入れてコミットする (秘密ではない).
4. 画面の My Profile → API Tokens → Create Token → Custom token で, CI 用の API トークンを作る.
   - 権限: Account の「Workers Scripts: Edit」と「D1: Edit」だけ.
   - 対象 (Account Resources): このアカウントだけ.
   - トークンは作ったときに一度だけ表示される. 5 で登録したら, ほかの場所に残さない.
5. GitHub のリポジトリの Settings → Secrets and variables → Actions → New repository secret で, 次の 2 つを登録する.
   - `CLOUDFLARE_API_TOKEN`: 4 で作ったトークン.
   - `CLOUDFLARE_ACCOUNT_ID`: アカウントの id (画面のアカウントのホームか Workers & Pages の右側にある Account ID).
6. 検出器の Release を作り, `web/detector.lock` をコミットする ([../logic/usage.md](../logic/usage.md) の「Web に出す」).
7. push する. デプロイのワークフローは「未適用の migration があります」で止まる (本番の D1 はまだ空のため).
8. GitHub の Actions → migrate → Run workflow で migration を当てる. migrate は push して GitHub に載ってから起動できる.
9. 止まったデプロイのワークフローを Re-run jobs で再実行する. 最後の手順のログに URL が出る.
10. ブラウザで, マッチを作る, 別のブラウザで参加する, `/count` でチップを検出する, を確かめる.

- 最初のデプロイが権限のエラー (Worker を作れない) で止まったら, 下の「手元から本番に触るとき」の形で, 1 回だけ手元からデプロイして Worker を作る.
  Worker を新しく作るには, 4 のトークンより強い権限が要ることがあるため. 2 回目からは CI でデプロイできる.

### 手元から本番に触るとき

戻すとき (下の「戻し方」) や, 最初のデプロイを手元で行うときだけ, 期限付き (例: 1 日) の API トークンを画面で別に作り, 環境変数で渡す.
使い終わったら画面で消す. CI 用のトークンを手元に写して使い回さない.

```sh
cd web
export CLOUDFLARE_API_TOKEN=<そのときだけのトークン>
export CLOUDFLARE_ACCOUNT_ID=<アカウントの id>
npm run build && npx wrangler deploy     # 例: 最初のデプロイ
```

### ふだんの流れ

`web/`, `scripts/fetch_detector.sh`, `deploy.yml` のどれかを変えたコミットを push すると, デプロイされる.
C++ や文書だけのコミットではデプロイされない.

デプロイのワークフローは, 次のどれかで止まり, そのときはデプロイしない.

- `npm run check` が通らない.
- 検出器の sha256 が `web/detector.lock` と合わない.
- 本番の D1 に未適用の migration がある.

### migration を足したとき

1. migration を足したコミットを push する. デプロイのワークフローは「未適用の migration があります」で止まる.
2. Actions → migrate → Run workflow で当てる. ログの最初に, 当てる前の戻し先 (Time Travel の bookmark) が出る.
3. 止まったデプロイのワークフローを再実行する.

migration は, 古いコードのまま当てても壊れない形 (表や列を足すだけ) にする. 消す・名前を変えるときは, コードを先に出してから別の migration で消す.

### 検出器を出し直すとき

core, `wasm/`, モデルを変えたときだけ要る. 手順は [../logic/usage.md](../logic/usage.md) の「Web に出す」.
`web/detector.lock` を変えたコミットを push すると, その検出器でデプロイされる.

### 戻し方

- コード: 前のコミットに戻すコミットを作って push する. 急ぐときは「手元から本番に触るとき」の形でトークンを渡し, `npx wrangler rollback` (直前の版に戻す) を流す.
  `wrangler rollback` で戻しても, 次の push で main の内容が出る.
- DB: migration のワークフローのログに出た bookmark で, 当てる前に戻す. 無料プランで戻せるのは 7 日前まで.
  「手元から本番に触るとき」の形でトークンを渡してから流す.

  ```sh
  cd web
  npx wrangler d1 time-travel restore DB --bookmark=<bookmark>
  ```

  戻した時点より後に入った持ち点などは消える. 人が判断してから行う.

### 本番のログ

Cloudflare の画面の Workers & Pages → pokerchip-score → Logs で見る (Workers Logs. 無料プランでは 3 日分).
「サーバーで問題が起きました」が出たら, ここにエラーの名前と内容が出る (トークンは出さない).
