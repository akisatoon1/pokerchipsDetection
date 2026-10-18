# Web アプリの起動

点数計算の Web アプリ (`web/`) を, 手元の Linux で起動する手順をまとめる.
API, 画面, DB (D1) はすべてローカルで動く. Cloudflare のアカウントは要らない.

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
8787 番のポートが使われているときは `npm run dev -- --port 8788` のように別のポートを指定する.

### 試し方

1. http://localhost:8787 でマッチを作る. 作った人がリーダーになる.
2. 出てきた URL を, 別のブラウザかプライベートウィンドウで開いて参加する.
   トークンはブラウザごとに保存されるので, 同じブラウザの同じウィンドウでは 2 人目になれない.
3. リーダーの画面でラウンドを始め, それぞれの画面で持ち点を入れ, リーダーが確定する.

## コードを変えたとき

| 変えたもの | すること |
|---|---|
| API (`src/server/`, `src/rules/`) | 何もしなくてよい. `wrangler dev` が読み直す |
| 画面 (`src/client/`) | 別の端末で `npm run build` を実行し, ブラウザを読み直す |
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

書き方と検査の詳しいことは [typescript.md](typescript.md) にある.

## うまくいかないとき

- `node: command not found`: PATH が通っていない. `source ~/.bashrc` を実行するか, 新しい端末を開く.
- `Address already in use`: 8787 番を他のものが使っている. 前に起動した `npm run dev` が残っていないか確かめるか, `--port` で別のポートを使う.
- 画面に古い内容が出る: `npm run build` をし直して, ブラウザを読み直す.
- 「サーバーで問題が起きました」と出る: `npm run dev` の端末にエラーが出ている. migrations を当て忘れていないかも確かめる.

## デプロイ

本番 (Cloudflare) へのデプロイの手順は, まだ書いていない. デプロイは人に指示されたときだけ行う ([development.md](development.md)).
