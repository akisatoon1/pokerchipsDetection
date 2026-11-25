# 手元の Web のサーバーを make で立て, 検出器も作り直す

承認日: 2026-11-25

## 人の指示

```
本番サーバの方は自動デプロイされるっぽく検出器の更新も含むっぽいが、ローカルの方は検出器を含めたビルドをしていないきがする。原因を調べて。
```

```
今のサーバは閉じて良い。web ローカルサーバを立てるときもmakeに入れてはどうだろうか?
```

```
進めて
```

## 計画

### 原因 (調べた結果)

- 本番は, CI が push のたびに `scripts/build_wasm.sh` で検出器を作り直す.
- 手元の `npm run dev` は, 画面のビルド, migration, `wrangler dev` だけで, 検出器を作り直さない.
  `make setup` も, 検出器がもうあれば飛ばす. core を変えたら人が `scripts/build_wasm.sh` を流す決まりだけがあり, 抜けると古いまま動く.
- 実際に, 手元の検出器 (20:31 に作ったもの) には, そのあとの core のコミット `4512a5c` (奥に写ったスタックを幅で見分けて数えない) が入っていなかった.
  今の main で作り直したものと比べると, モデルと `.js` は同じで, `.wasm` だけが違った.

### 機能 1: `make web-dev` と `make web-dev-lan`

- `make web-dev`: `scripts/build_wasm.sh` で検出器を作り直してから, `web/` で `npm run dev` を流す.
  cmake は変わったところだけを作るので, 変わっていなければ 1 秒ほどで済む. 毎回作り直し, 人の手順の抜けで古い検出器が動かないようにする.
- `make web-dev-lan`: 上と同じで, `npm run dev -- --ip 0.0.0.0` で立てる. スマートフォンから LAN で開くとき用.
  変数 (`LAN=1`) でなく別のターゲットにするのは, 打ち間違えたときに黙って localhost だけで立たないようにするため.
- 作業ツリーにある core をそのまま使う (コミットしていない変更も入る). CLI と同じく, 手元の状態で動かすため.

変えるファイル:

- `Makefile`: 上の 2 つのターゲット.
- `docs/web/running.md`: 起動とスマートフォンから試す手順を `make` にし, 「コードを変えたとき」の表を直す.
- `docs/environment/setup.md`, `docs/logic/usage.md`: `npm run dev` と, 検出器を手で作り直す案内を直す.
- `docs/worklog.md`: 足したターゲット.

テストの観点 (手元で確かめる):

- core を変えずに `make web-dev` を流すと, 検出器の作り直しはすぐ終わり, サーバーが立つ.
- `make web-dev-lan` で立てると, PC の LAN の住所で `/count` と検出器が開ける.
- 今の手元の検出器 (古いもの) は, `make web-dev` のあと今の core で作ったものになる.

### コミットの分け方

1. `docs: 計画 手元の Web のサーバーを make で立てる を残す`
2. `build: make web-dev で検出器を作り直してから Web のサーバーを立てる` (Makefile, 文書, 作業記録, 進み具合)

## 進み具合

- [x] 機能 1: `make web-dev` と `make web-dev-lan`

## 計画の変更

### 2026-11-25

- 人の指示: make web-devはlanでも開けるようにして。web-devだけでよい
- 変更: `make web-dev-lan` を消し, `make web-dev` をいつも `npm run dev -- --ip 0.0.0.0` で立てる.
  PC からだけ開けるように立てるときは, `scripts/build_wasm.sh` のあと `cd web && npm run dev` を流す (文書に書く).
