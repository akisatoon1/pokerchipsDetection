# Android アプリの Kotlin の書き方

Android アプリ (`android/app/src/main/java/`, `android/app/src/test/`) の Kotlin に固有の書き方をまとめる.
言語によらない規則は [code-rules.md](code-rules.md) にあり, Kotlin でもそのまま守る.
JNI の C++ (`android/app/src/main/cpp/`) は [../coding-style.md](../coding-style.md) に従う.

TypeScript の規則 ([typescript.md](typescript.md)) と同じ考えで決めている. 対応は次のとおり.

| TypeScript の規則 | Kotlin での書き方 |
|---|---|
| 規則は `src/rules/` の純粋な関数 | 規則は Android の API (Context, View など) に触れない関数にし, JVM の単体テストで確かめる |
| `any` と `as` を使わない | `!!` と, 失敗すると例外になる `as` を使わない |
| 失敗は `{ ok, value } \| { ok, reason }` で返す | 失敗は `sealed interface` で返す |
| export するものに `/** */` | 外から使うものに KDoc (`/** */`) |

## 技術

| 役割 | 使うもの |
|---|---|
| 言語 | Kotlin |
| 画面 | Jetpack Compose. マッチの画面は WebView で Web を表示する |
| WebView と Web の連絡 | `androidx.webkit` (`addWebMessageListener`) |
| 下に引いて更新 | `androidx.swiperefreshlayout` |
| 端末への保存 | SharedPreferences |
| テスト | JUnit (`src/test/`. JVM で動かす) |
| 整形 | Android Studio の整形 (Kotlin の公式の書き方. `gradle.properties` の `kotlin.code.style=official`) |
| lint | Android Lint (AGP に入っている) |

## ディレクトリ

パッケージは `com.pokerchip.app` の下に置く.

| 場所 | 中身 |
|---|---|
| `com.pokerchip.app` | JNI のラッパー, 解析の結果, 画像の読み込み, ViewModel |
| `com.pokerchip.app.chips` | 色と点数の対応と, チップから持ち点を求める規則. 規則の関数は Android の API に触れない |
| `com.pokerchip.app.web` | WebView の設定, 開く URL の判定, Web との連絡 (bridge) |
| `com.pokerchip.app.ui` | Compose の画面 |

## 検査

`android/` で次を流す. Android を変えたコミットの前に必ず通す.

```sh
export JAVA_HOME=/usr/local/android-studio/jbr   # Android Studio に入っている JDK. 場所は入れ方で変わる
./gradlew assembleDebug testDebugUnitTest lintDebug
```

整形は Android Studio の「Reformat Code」で行う. 整形の道具を足していないので, 検査には入らない.

## 書き方

### 名前

- Kotlin の普通の書き方に従う. 関数と変数は camelCase, 型は PascalCase.
- 定数 (`const val` と, トップレベルや `companion object` の変わらない値) は UPPER_SNAKE_CASE.
- ファイル名は, 中心になる型か関数の名前にする (`ChipPoints.kt`).

### コメント

- 外から使う関数・型・定数には KDoc (`/** */`) を付け, 役割, 引数, 戻り値, 失敗したときの振る舞いを書く.
  1 行で済むなら `/** ... */` を 1 行で書いてよい.
- 理由は `//` のコメントで書く. 仕様に由来するコードには, その仕様を書く.

### 型と検証

- `!!` を使わない. null になりうる値は `?.`, `?:`, `let` などで扱う.
- 失敗すると例外になる `as` を使わない. 型を確かめるときは `is` か `as?` を使い, 違ったときの扱いを書く.
- 外から来る値 (Web からのメッセージ, 端末に保存した値) は, 入口で検証してから使う. 知らない種類のメッセージは無視する.
- Web と同じ上限 (持ち点の上限など) は定数にし, `web/src/rules/limits.ts` のどの値と同じかをコメントに書く.
  言語が違って共有できないため. 最後はサーバーが確かめる.

### 失敗の伝え方

- 規則の関数は, 決まりを満たさないことを例外ではなく戻り値で返す. 呼ぶ側が失敗を必ず扱うようにするため.

  ```kotlin
  sealed interface ChipValueInput {
      data class Valid(val points: Int?) : ChipValueInput
      data class Invalid(val reason: String) : ChipValueInput
  }
  ```

- 思わぬ失敗 (画像が読めない, native の例外) は捕まえて, 画面に意味の分かる言葉で出す. 握りつぶさない.

### 画面

- 画面の状態は ViewModel に持ち, Compose の関数は状態を受けて描くだけにする.
- 点数の増減と累計は計算しない. それは Web (とバックエンド) の役目で, アプリが求めるのはチップからの持ち点だけ.

### WebView

- WebView で開くのは, 接続先と同じ scheme, ホスト, ポートのページだけにする. ほかは外のブラウザに渡す.
- bridge は, 接続先のページからのメッセージだけを受ける (`addWebMessageListener` の許すオリジン).
  `addJavascriptInterface` は, どのサイトのページからでも呼べてしまうので使わない.
- ファイルへのアクセス (`allowFileAccess`, `allowContentAccess`) は切る.
- トークンを WebView の外に出さない. ログにも出さない.
