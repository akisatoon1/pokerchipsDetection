# 地図: Web (`web/`)

点数計算アプリ (Web の画面, API, DB) の作業で読む.

## 作業の前に必ず読む (ルール)

- [../development/web/process.md](../development/web/process.md) 開発の流れ. 計画を示して承認を得るまでコードを書かない
- [../development/web/layers.md](../development/web/layers.md) 層の分け方 (画面, API, 規則, DB アクセス)
- [../development/web/security.md](../development/web/security.md) Web に固有のセキュリティの規則 (id とトークン, 権限の確認, XSS など)
- [../development/web/typescript.md](../development/web/typescript.md) TypeScript の書き方と検査のコマンド

## 作業の前に読む (文脈)

- [app.md](app.md) アプリの仕様 (構成, データ, 操作と権限)
- [scoring.md](scoring.md) 点数の計算のルール
- [plans/](plans/) 承認された計画. 「進み具合」に終わっていない項目があれば, そこから続ける

## 要るときに読む

- [running.md](running.md) 手元での起動の手順. スマートフォンのブラウザから LAN で開く手順. 本番へのデプロイの手順と戻し方
- [../architecture.md](../architecture.md) ブラウザでのチップの検出 (「10. Web でも core を WASM にして動かす」). デプロイの仕組み (「11. デプロイ」)
- [../logic/usage.md](../logic/usage.md) の「WASM」 WASM のビルドと, CLI と結果が同じかの確かめ方
