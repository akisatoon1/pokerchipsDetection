# 検出器を CI でビルドし, モデルだけを Release から取る

承認日: 2026-11-25

## 人の指示

https://github.com/akisatoon1/pokerchipsDetection/issues/1 というイシューについて。まずは調査。cloudflare ciでは何に依存してどう自動テストやデプロイを行っているのか調べて

依存すべきなのは、webだが、webが依存しているのはコアロジックなど他にもあるだろう。

またモデルとかも依存しているかも。そういう全ての依存の変更をちゃんとデプロイしないといけないと思う

検出器がrealeaseから取ってきているのか。webの更新時に人でreleaseを作成したくない。変更に合わせてそれも更新したいのだがどういう構成にするのがいいか

検出器はciでテストすべき内容があるのか? ビルドだけでよいのでは。まずはなるべくシンプルにしたい。yolo,それを利用したコアロジックの更新からのビルド->デプロイを行うためになるべく動作をシンプルにするには

モデルの変更のみ人がonnxの更新という形で行う。それいがいは自動化できるか? またonnxは重いのでgitで管理したくないのだができるか?

作業計画。

承認。pushは最後に行え。ci二必要な作業をすべて行ってからの最後にね。その作業が行えないなら停止して人に依頼せよ。

## 計画

### 目的

- 人が手で行うのは, モデルを替えるときの ONNX の更新だけにする.
- core, `wasm/`, web, ビルドのスクリプトの変更は, push すれば CI がビルドからデプロイまで行う.
- ONNX は git に入れない.

### 範囲 (承認を得たこと)

- `web/` と Web の文書の外の `scripts/`, `.github/workflows/deploy.yml`, `.gitignore`, `models/model.lock` (新規),
  `docs/architecture.md`, `docs/logic/usage.md`, `docs/environment/setup.md`, `docs/worklog.md` も変える.
- 今の手元のモデル (2026-11-23 に書き出したもの. しきい値 0.9 用) で, モデルの GitHub Release を 1 つ作る.
- 古い検出器の Release (`detector-*`) は消さずに残す.
- push は, CI に要る作業をすべて終えてから, 最後に AI が行う (人の指示).

### 構成

```
人 (モデルを替えるときだけ):
  export_model.sh best.pt → (手元の全体テストで試す) → release_model.sh
     ├→ GitHub Release model-<ONNX の sha256 の先頭 12 文字> (chip_detector.onnx だけ)
     └→ models/model.lock (タグと sha256) を書く → コミットして push

CI (deploy.yml. push のたびに):
  checkout → fetch_model.sh (Release からモデルを取り, sha256 を確かめる)
  → Emscripten  [キャッシュ. key = fetch_emsdk.sh の hash]
  → WASM 用の OpenCV [キャッシュ. key = 用意するスクリプトの hash]  ← ないときだけソースを取ってビルド
  → build_wasm.sh (core + wasm + モデル → 検出器)  ← 毎回ビルド
  → npm ci → npm run check → migration の確認 → npm run build → wrangler deploy
```

- CI では検出器をテストしない (ビルドだけ). Emscripten や OpenCV の版, `wasm/` の設定を変えたときは,
  手元で `compare_wasm_cli.sh` を流す決まりにし, 文書に書く.
- Release のタグはモデルの sha256 から付ける. 同じモデルなら同じタグになり, 二重に作らない.
  タグがもうあれば, Release は作らずに lock だけを書く.
- テスト画像は Git LFS なので, CI のチェックアウトでは中身を取らない. 今のままで重くならない.
- `fetch_model.sh` は手元でも使え, `.pt` のないマシンでもモデルを取れる.

### 作業の順番とファイル

1. モデルを Release に置き, そこから取る
   - `scripts/release_detector.sh` → `scripts/release_model.sh` (モデルだけ, タグは sha256 から)
   - `scripts/fetch_detector.sh` → `scripts/fetch_model.sh` (`models/chip_detector.onnx` に置く)
   - `.gitignore`: `models/` は無視したまま `models/model.lock` だけ入れる (`models/VERSION` は手元の絶対パスがあるので入れない)
   - `release_model.sh` を流して Release と `models/model.lock` を作る
2. 外から取るものの版を固定する
   - `scripts/fetch_emsdk.sh`: タグ `6.0.13` で clone する
   - `scripts/fetch_opencv_source.sh` (新規): OpenCV のソースを取り, sha256 を確かめる
   - `scripts/build_opencv.sh`, `scripts/build_opencv_wasm.sh`: ソースの取得を上に任せる
3. デプロイで検出器をビルドする
   - `.github/workflows/deploy.yml`: 上の CI の流れ. `actions/cache` は SHA で固定.
     `paths` に `web/**`, `core/**`, `wasm/**`, `models/model.lock`, 使うスクリプトのすべて, `deploy.yml`
4. 検出器の Release の仕組みを消す: `web/detector.lock`
5. 文書: `docs/architecture.md` の 11, `docs/web/deploy.md`, `docs/logic/usage.md`, `docs/environment/setup.md`,
   `docs/web/running.md`, `docs/web/README.md`, `docs/worklog.md`

### 確かめること

手元 (CI と同じ手順を, まっさらな `third_party/` で流す):

- `fetch_model.sh` で, lock と同じ sha256 のモデルが置かれる.
- lock の sha256 を 1 文字変えると, `fetch_model.sh` は何も置かずに失敗する.
- `fetch_opencv_source.sh` も, sha256 が違えば失敗する.
- `fetch_emsdk.sh` → `fetch_opencv_source.sh` → `build_opencv_wasm.sh` → `build_wasm.sh` で 3 つのファイルができる. OpenCV のビルドの時間を測る.
- `compare_wasm_cli.sh` を全部のテスト画像で流し, 新しいモデルとしきい値で WASM と CLI の結果が一致する.
- `npm run check` が通る.
- `deploy.yml` の `paths` に, `build_wasm.sh` と OpenCV の用意が読むファイルがすべて入っている.

push のあと:

- CI のデプロイが成功し, 本番の `/count` で新しい検出器が動く.
- 1 回目 (キャッシュなし) と 2 回目 (キャッシュあり) にかかった時間を Actions のログで確かめる.

### コミットの分け方

1. `docs: 計画 検出器を CI でビルドする を残す`
2. `build: モデルを GitHub Release に置き, そこから取る`
3. `build: Emscripten と OpenCV のソースの版を固定する`
4. `ci: デプロイで検出器をビルドする`
5. `chore: 検出器の Release の仕組みを消す`
6. `docs: 検出器を CI でビルドする構成を文書に書く`

### 気をつけること

- 1 回目の CI はキャッシュがなく, OpenCV のビルドで遅い. 手元で測った時間から `timeout-minutes` を決める.
- キャッシュは 7 日使わないと消える. 消えたら次のデプロイが自動で作り直す.
- push すると, その時点の core (しきい値 0.9) と新しいモデルが本番に出る. Web の検出の結果は変わる.

## 進み具合

- [x] 1. モデルを Release に置き, そこから取る
- [x] 2. 外から取るものの版を固定する
- [x] 3. デプロイで検出器をビルドする
- [x] 4. 検出器の Release の仕組みを消す
- [x] 5. 文書
- [x] push と CI の確認
  - 最初の実行 (キャッシュなし) は 6 分 43 秒で成功した. WASM 用の OpenCV のビルド 5 分 8 秒, Emscripten の取得 21 秒,
    検出器のビルド 17 秒, キャッシュの保存 8 秒.
  - 本番のモデルの sha256 は `models/model.lock` と一致した. 本番の 3 ファイルを取り, `testimages/v2/yoko/` の 35 枚で CLI と一致した.
  - 2 回目 (キャッシュあり) の時間は, 次のデプロイで確かめる.

## 計画の変更

### 2026-11-25

- 人の指示: なし (AI の作業の誤りの記録)
- 変更: 4 の `web/detector.lock` の削除は, 先に削除をステージしていたため, 3 のコミット (`ci: デプロイで検出器をビルドする`) に入った.
  履歴は書き換えない決まりのため, そのままにした. 4 の別のコミットはない.
- 手元で CI と同じ手順をまっさらな作業ツリーで流した時間: モデルの取得 1 秒, Emscripten の取得 38 秒,
  WASM 用の OpenCV のビルド 288 秒, 検出器のビルド 16 秒 (4 コア). これをもとに `timeout-minutes` を 30 にした.

### 2026-11-25 (2)

- 人の指示: テスト画像はv2のyokoのみにせよ。これをルールにして
- 変更: WASM と CLI の比べ (`functional_tests/compare_wasm_cli.sh`) に使う画像を `testimages/v2/yoko/` だけにし, スクリプトの既定と文書
  (`docs/logic/usage.md`, `docs/architecture.md`, `docs/web/deploy.md`) に決まりとして書いた.
  計画の「確かめること」の「全部のテスト画像で流す」は, `testimages/v2/yoko/` で流すことに変えた.
