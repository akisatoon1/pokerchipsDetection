# 地図: Android (`android/`)

Android アプリ (Kotlin) と, core を呼ぶ JNI の C++ の作業で読む. アプリは core のチップの検出を実機で確かめるためのもの.

## 作業の前に必ず読む (ルール)

- [../development/android/kotlin.md](../development/android/kotlin.md) Kotlin の書き方と検査のコマンド
- [../development/cpp-coding-style.md](../development/cpp-coding-style.md) JNI の C++ (`android/app/src/main/cpp/`) を触るときだけ

## 作業の前に読む (文脈)

- [../architecture.md](../architecture.md) の「8. Android アプリは, core を実機で確かめるためだけに使う」 アプリの構成と, core を JNI で呼ぶ理由

## 要るときに読む

- [usage.md](usage.md) アプリをビルドして端末で動かす make のコマンド, 端末で保存した画像の取り出し方
- [../environment/setup.md](../environment/setup.md) Android のビルド環境 (Android Studio と SDK, `make setup`)
- [../logic/usage.md](../logic/usage.md) core の動きを Linux で確かめるとき
