# Web にチップの検出を入れる

承認日: 2026-11-15

## 人の指示

```
webでも問題ないならいっそwebにすべての機能を盛り込んでandroidもそのwebを使うようにするというのを考えたがどうか? そのためにブランチを作ってwebでできるかどうかをそっちで試すみたいな案で行う。
git branchを作成したのでそっちでの計画をして
```

```
途中でテストがしたいとき、実機などの方がやりやすいときがあるので、そのときはぐるぐる回すのでなくて私に依頼してほしい。最後のwebを使って実際に写真を撮ってテストするのは私が行うのでやらなくていい。
1, ブランチはweb-detectionでよい.
2よい。現在のドキュメントにも変更があればドキュメントを更新せよ。
3, よい。4 よい。
1, nativeは最終的に消す方針だが今回はweb関連の実装のみして。
2, 3, 4よい。iphoneなどの実機テストは手動で行いたいので必要があれば依頼せよ。こちらでテストをすると停止する可能性があるのでするな。
大まかな計画を教えて
```

```
承認する
```

最初の「1〜4」は「承認してほしいこと」(ブランチ, 触る場所, 道具と依存, モデルを公開の URL で配る) への答え.
次の「1〜4」は「決めてほしいこと」(Android の解析, 数えるだけの画面, デバッグ用の画像の保存, 判定の基準) への答え.
Android の解析は「最終的に native を消すが, 今回は Web の実装だけ」と決まったので, Android を変える段階はこの計画から外した.

## 計画

### 決めたこと

- core を Emscripten で WebAssembly (WASM) にし, ブラウザの中でチップを検出する. core のコードは写さず,
  JNI と同じ薄い殻 (`wasm/`) から `add_subdirectory` で使う. 写真はサーバーに送らない.
- 先に「できるか」を試し (段階 A), 判定が通ったら Web に機能を作る (段階 B).
- 判定の基準
  - 一致: `testimages` の全画像で, スタックの数, box, count, peaks, colors が Linux の CLI の `--json` と一致する. score の差は 0.001 以内.
  - 速さ: iPhone の Safari と Android の Chrome で, 12MP の写真 1 枚の解析が 5 秒以内, 初回の読み込みが 15 秒以内. 途中で落ちない.
- Android は変えない. 最終的には Android も Web の検出を使い, native と Kotlin の画面を消す方針だが, 別の計画で行う.
  それまで Android アプリの中の「チップから入力」は, 今の bridge (native の検出) を使う.
  WebView は今のままでは写真を選ぶ画面を開けないため.
- 数えるだけの画面は Web の `/count` として残す. デバッグ用の画像の保存 (`ImageSaver`) は Web には作らない.
  Web では元の写真が端末にそのまま残るため.
- 色と点数の対応はブラウザの localStorage に 1 つ持つ (端末に 1 つ持つという今の仕様のまま).
- 画像は色空間を変換せずに core に渡す (`createImageBitmap` の `colorSpaceConversion: "none"`).
  テスト画像の多くは Display P3 で, Linux の `cv::imread` は ICC を無視して値をそのまま読み, 基準色もその値から作っているため.
  Safari が対応しているかは段階 A の実機の確認で確かめる.
- 実機 (iPhone, Android) での確認は人が行う. AI は手順と見てほしい点を示して依頼し, 自分では試さない.
  Web で実際に写真を撮っての最後のテストも人が行う.

### 承認されたこと

- **ブランチ**: この計画に限り, main でなくブランチ `web-detection` にコミットする. main への取り込みと push は, 人に言われたときだけ行う.
- **触る場所の例外**: この計画に限り, `web/`, `docs/` に加えて, `wasm/` (新規), `scripts/`, `functional_tests/`, `.gitignore`, `CLAUDE.md` の変更を許す.
  `core/`, `cli/`, `android/` は変えない. 今ある文書で古くなるところも直す.
- **道具を足す**: Emscripten (emsdk) と, WASM 用にビルドした OpenCV 4.14.0. どちらも `third_party/` に置き, git の管理外にする. npm の依存は足さない.
- **モデルを Web で配る**: モデル (ONNX, 約 9.8MB) を Static Assets に置き, 誰でも取れる URL で配る.

### 機能と順番

#### 段階 A: できるかを試す

##### 1. core を WASM にし, Linux と同じ結果が出るかを Node で確かめる

| ファイル | 変えること |
|---|---|
| `scripts/fetch_emsdk.sh` (新規) | Emscripten (emsdk) を `third_party/` に取る. バージョンは固定する |
| `scripts/build_opencv_wasm.sh` (新規) | OpenCV 4.14.0 を WASM 用にビルドする (`core,imgproc,dnn`, 静的ライブラリ, 1 スレッド) |
| `wasm/CMakeLists.txt`, `wasm/bindings.cpp` (新規) | JNI と同じ薄い殻. モデルのバイト列で作る, RGBA の画素を解析して `toJson` を返す, 解放する. core は `add_subdirectory` する |
| `scripts/build_wasm.sh` (新規) | 殻をビルドし, `.js`, `.wasm`, モデルを `web/src/client/public/detector/` に置く |
| `functional_tests/compare_wasm_cli.mjs`, `functional_tests/compare_wasm_cli.sh` (新規) | 全画像を Node の WASM と CLI の両方で解析し, 結果を比べる |
| `.gitignore` | `web/src/client/public/detector/` (ビルドの結果とモデル) を足す |

テストの観点:

- 全画像で, WASM と CLI の結果が判定の基準で一致する.
- 違う画像があれば, どの画像のどの値が違うかを出す.
- 空の画像や, 壊れたモデルを渡すと, 落ちずにエラーの文が返る.
- WASM とモデルの各ファイルが, Workers の Static Assets の 1 ファイルの上限 (25 MiB) に収まる.

##### 2. 数えるだけの画面の最小版を作り, 実機で測る

| ファイル | 変えること |
|---|---|
| `web/src/client/detector.ts` (新規) | WASM とモデルを初回だけ読む. 画像を向きを直した RGBA にして解析し, 読み込みと解析の時間を返す |
| `web/src/rules/analysis-result.ts` (新規) | core の JSON を zod で読む (Kotlin の `AnalysisResult.fromJson` に当たる) |
| `web/src/client/pages/count-page.ts` (新規), `web/src/client/main.ts` | `/count`. 撮影 / 選択 → 解析 → スタックごとの枚数と色, 読み込みと解析の時間を出す |
| `web/test/analysis-result.test.ts` (新規) | 下の観点 |

テストの観点:

- core の `toJson` の出力を読める. count が null のスタックも読める.
- 知らない項目や, 型の違う値があれば拒否する.
- 実機 (人に依頼する): iPhone の Safari と Android の Chrome で, PC の `wrangler dev` に LAN から開き, 撮影と選択の両方で解析できる. 判定の基準の速さを満たすか.
- 実機 (人に依頼する): 同じ写真を CLI でも解析し, 結果が同じになる (画像の向きと色空間の確認).

ここで判定の結果を人に報告し, 段階 B に進むかを決めてもらう.

#### 段階 B: Web に機能を作る

##### 3. 仕様と規約と文書を直す

| ファイル | 変えること |
|---|---|
| `docs/web/app.md` | 全体の構成 (検出は Web が行い, ブラウザでも使える), 色と点数の設定, 数えるだけの画面, チップから入力 (ブラウザでは Web の検出, アプリの中では当面 native) |
| `docs/architecture.md` | core を Linux, Android, Web (WASM) で共有する構成. WASM の節を足す. Android を Web に寄せる方針を「今後の課題」に書く |
| `docs/development/web/typescript.md`, `docs/development/web/layers.md` | 画面が規則 (チップから持ち点への換算) を直接呼んでよいことと, その理由 (バックエンドに換算を置かない仕様) |
| `CLAUDE.md`, `docs/README.md`, `docs/web/README.md`, `docs/logic/README.md` | `wasm/` を足す. 地図を直す |
| `docs/environment/setup.md`, `docs/logic/usage.md`, `docs/web/running.md`, `docs/worklog.md` | emsdk と OpenCV の WASM のビルド, WASM のビルドと比較の流し方, LAN から開く手順 |

##### 4. 色と点数を設定する

| ファイル | 変えること |
|---|---|
| `web/src/rules/chip-values.ts` (新規) | 7 色の一覧 (画面に出す名前, 見本の色, core の色の名前) と, 欄の文字の検証 (Kotlin の `ChipValues.kt` に当たる) |
| `web/src/client/chip-values-store.ts` (新規) | localStorage に保存する. 範囲外の値は決めていないものとして読む |
| `web/src/client/pages/chip-values-page.ts` (新規), `web/src/client/main.ts`, `web/src/client/pages/home-page.ts` | `/chips` の設定画面と, トップページからのリンク |
| `web/test/chip-values.test.ts` (新規) | 下の観点 |

テストの観点:

- 空欄は「使わない色」として受け付ける. 前後の空白は除く.
- 1 と 1,000,000,000 は受け付け, 0 と 1,000,000,001 は拒否する.
- 小数, 符号, 全角の数字, 文字は拒否する.
- core の色の名前から色を引ける. `unknown` は見つからない.

##### 5. 数えるだけの画面を仕上げる

| ファイル | 変えること |
|---|---|
| `web/src/rules/chip-points.ts` (新規) | 解析の結果と色ごとの点数から, 持ち点と色ごとの内訳, または求められない理由をすべて返す (Kotlin の `ChipPoints.kt` に当たる) |
| `web/src/client/result-views.ts` (新規) | Canvas で, 全体画像に枠と「#n: m枚」を描く. スタックごとの確認画像 (ROI を 20% 広げて切り出し, 合わせ目の線と色のラベル) を描く |
| `web/src/client/pages/count-page.ts` | 上の 2 つを使う. 点数を決めてあれば持ち点を出す |
| `web/test/chip-points.test.ts` (新規) | 下の観点 |

テストの観点:

- スタックが複数あれば, 色ごとに合計する. 内訳は色の一覧の順で, 1 枚以上ある色だけを出す.
- スタックがない, 数えられないスタックがある, `unknown` の色がある, 点数を決めていない色がある, のどれでも止め, スタックの番号と何枚目かを返す.
- 理由が複数あれば, すべて返す.
- 合計が 1,000,000,000 ちょうどなら求められ, 超えると止める.

##### 6. チップから入力する (ブラウザで)

| ファイル | 変えること |
|---|---|
| `web/src/client/pages/chip-input-dialog.ts` (新規) | マッチの画面の上に重ねる検出画面. 点数が未設定なら先に設定を出す. 「この点数を入れる」で欄に入れて閉じる. 閉じたら何も入れない |
| `web/src/client/pages/rounds-section.ts` | 「チップから入力」を, 入力中のラウンドの自分の欄に出す. アプリの中では今の bridge, ブラウザでは上の検出画面を使う |

テストの観点:

- 規則は 4 と 5 のテストで確かめる.
- 画面 (人に依頼する): 求めた持ち点が欄に入るが, 送られない. 求められないときは「この点数を入れる」を押せない.
  閉じたら欄は変わらない. 設定を変えたら持ち点を計算し直す. 閉じたあとも, 入力中の欄と画面の位置が保たれる.
- アプリの中では, 今までどおり Android の検出画面が開く.

### この計画に入れないこと

- Android の変更 (WebView で写真を選べるようにする, native と Kotlin の検出画面を消す). 将来の計画で行う.
- Web で実際に写真を撮っての最後のテスト. 人が行う.

### コミットの分け方

- 計画の記録 → 1 (emsdk と OpenCV のスクリプト, 殻とビルド, 比較) → 2 (規則とテスト, 画面) → 判定 → 3 → 4, 5, 6 は機能ごとに「規則とテスト」「画面」に分ける.
- Web を変えたら `npm run check`, C++ を変えたら `make check` を, コミットの前に通す.

## 進み具合

- [x] 1. core を WASM にし, Linux と同じ結果が出るかを Node で確かめる
- [x] 2. 数えるだけの画面の最小版を作り, 実機で測る
- [x] 判定 (段階 B に進むか)
- [x] 3. 仕様と規約と文書を直す
- [x] 4. 色と点数を設定する
- [ ] 5. 数えるだけの画面を仕上げる
- [ ] 6. チップから入力する (ブラウザで)

### 判定の結果 (2026-11-15)

人が iPhone (Firefox) で `/count` を開き, チップを検出できることを確かめた. 人の判断で段階 B に進む.

```
チップの検出はできた。進めて良い。
```

時間の数字と, 3 枚のテスト画像での CLI との比べは報告を受けていない. 速さが足りるかは, 6 のあとの人のテストで改めて見る.

## 計画の変更

- 2026-11-15: 4 で, トップページから `/chips` だけでなく `/count` にもリンクを張る. 実機の確認のとき, `/count` を開く手段がアドレスを入れるほかになく, 開けなかったため.
  変えるファイル (`home-page.ts`) は 4 の表にあるものと同じ.
