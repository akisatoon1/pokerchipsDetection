# Web アプリの起動

点数計算の Web アプリ (`web/`) を, 手元の Linux で起動する手順をまとめる.
API, 画面, DB (D1) はすべてローカルで動く. Cloudflare のアカウントは要らない.
本番 (Cloudflare) へのデプロイは [deploy.md](deploy.md) にある.

## 1. 用意する (最初の 1 回)

Node.js 24 を入れ ([../environment/setup.md](../environment/setup.md) の「Node.js 24」), リポジトリのルートで `make setup` を流す.
`make setup` は, npm のパッケージ (`web/node_modules/`) と, チップの検出に使う検出器 (`web/src/client/public/detector/`) まで用意する.

## 2. 依存を入れ直す (package.json が変わったとき)

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
ないと, 解析するときに「検出の仕組みを読み込めませんでした」と出る. `make setup` を流せば置かれる.
core やモデルを変えたときは, リポジトリのルートで `scripts/build_wasm.sh` を流して作り直す.

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

本番 (Cloudflare) へのデプロイ, モデルの替え方, 戻し方は [deploy.md](deploy.md) にある.
