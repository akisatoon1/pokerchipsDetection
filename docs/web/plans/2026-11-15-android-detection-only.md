# Android アプリをネイティブのチップ検出だけにする

承認日: 2026-11-15

## 人の指示

```
アンドロイドはチップ検出のみにする。みんなで使う機能はweb二集約したのでandroidアプリはチップ検出ロジックの実機テストのために使うこととする。よってandroidからはwebなどいらない機能を消して、もとのネイティブのチップ検出機能のみ残して。
```

```
よい。
```

2 つ目は, 「Android の色と点数の設定と持ち点の表示も消してよいか」「Web の側の bridge のコードも一緒に消してよいか」への答え.

## 計画

### アプリの形

- アプリを開くと, 今の「数えるだけ」の画面が最初の画面として出る (戻るボタンはない).
  撮影 / ギャラリーで画像を選んで解析し, 全体画像とスタックごとの確認画像を出す. 「この画像を保存」(テスト画像を集めるため) も残す.
- WebView, Web との連絡 (bridge), 上のバーのメニューはなくす.
- 色と点数の設定と, 持ち点の表示もなくす. 点数計算のための機能で, 今は Web にあるため.
  色の一覧 (`ChipColor`. 確認画像の色の見本に使う) は残し, 独立したファイルに移す.
- `INTERNET` の権限と, debug のビルドで平文の http を許す設定を消す. アプリはネットにつながなくなるため.
- 画面を回しても Activity を作り直さない設定 (`configChanges`) を消す. WebView の入力を保つためのものだった. 解析の結果は ViewModel にあるので, 回しても消えない.

### 消すもの・変えるもの (`android/`)

| ファイル | すること |
|---|---|
| `ui/WebScreen.kt`, `web/` (4 ファイル), `test/.../web/` (2 ファイル) | 消す |
| `ui/ChipInputScreen.kt`, `ui/ChipPointsViews.kt`, `ui/ChipValuesScreen.kt`, `ChipValuesViewModel.kt` | 消す |
| `chips/ChipPoints.kt`, `chips/ChipValuesStore.kt`, `test/.../chips/ChipPointsTest.kt` | 消す |
| `chips/ChipValues.kt` → `ChipColor.kt` | 色の一覧だけを残す. 点数の型と欄の読み取りは消す |
| `test/.../chips/ChipValuesTest.kt` → `ChipColorTest.kt` | 色を名前から引くテストだけを残す |
| `MainActivity.kt` | 数えるだけの画面だけを出す |
| `MainViewModel.kt`, `ui/CountScreen.kt` | 色ごとの点数と持ち点を外す. 戻るボタンを外す |
| `AndroidManifest.xml`, `src/debug/` | `INTERNET`, `configChanges`, 平文の http の設定を消す |
| `app/build.gradle.kts`, `gradle/libs.versions.toml` | `WEB_BASE_URL` を消す. `androidx.webkit` と `swiperefreshlayout` を外す. テスト用の `org.json` も, 使うテストがなくなれば外す |

core と JNI の C++ (`cpp/`) は変えない.

### Web の側

アプリが WebView で開かなくなるので, Web のアプリ向けのコードは使われなくなる. 使われなくなったコードは消す決まりに従う.

- `web/src/client/app-bridge.ts` を消す.
- 「チップから入力」は, いつも Web の検出画面で行う.
- 「URL をコピー」は, いつもブラウザのコピーの機能で行う.
- トップページのリンクとシークレットの注意書きの「アプリの中では出さない」を外す.

### 文書

- `docs/architecture.md`: 8 を「core を実機で確かめるためのアプリ」に書き直す. 10 の「Android を Web の検出に寄せる」課題を消す.
- `docs/web/app.md`: Android アプリの節と bridge の節を消し, Android アプリは使わないことを書く.
- `docs/development/android/kotlin.md`: 技術の表から WebView を消し, パッケージの表と WebView の書き方を直す.
- `docs/android/README.md`, `docs/README.md`: Android の分野の説明から WebView を消す.
- `docs/web/running.md`: 「Android アプリから試す」の節を消す.
- `docs/worklog.md`: 構成の変更と, 依存を外したことを記録する.

### 確かめ方

- `./gradlew assembleDebug testDebugUnitTest lintDebug` と, Web の `npm run check` を通す.
- 実機 (人に依頼する): アプリを開くとすぐ撮影とギャラリーのボタンが出る. 解析すると全体画像と確認画像が出る. 「この画像を保存」で保存できる.

### コミットの分け方

1. `refactor: 色の一覧を, 点数の設定から分けて独立したファイルにする` (Android)
2. `feat: Android アプリを, ネイティブのチップ検出の画面だけにする` (Android の画面, WebView, 依存, 権限)
3. `refactor: Web から Android アプリ向けの連絡 (bridge) を消す` (Web)
4. `docs: Android アプリをチップ検出の確認用にした構成を文書に書く`

## 進み具合

- [x] Android をネイティブのチップ検出だけにする
- [x] Web から bridge を消す
- [ ] 文書を直す

## 計画の変更
