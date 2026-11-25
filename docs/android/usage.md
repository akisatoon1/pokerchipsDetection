# Android アプリの使い方

Linux マシンから Android アプリをビルドして端末で動かす方法と, 端末で保存した画像を取り出す方法.
環境構築 ([setup.md](../environment/setup.md) の 7〜9) が済んでいることが前提.
コマンドはすべて **リポジトリのルートで** 実行する. スクリプトがリポジトリのルートからの相対パスでファイルを探すため.

## make のコマンド

よく使う操作は, ルートの `Makefile` にまとめてあり `make` で呼べる. ここには Android の作業で使うものを, 何をしたいときに使うかだけ書く.
各コマンドが実際に何を実行するかは `Makefile` を見る.

| コマンド | 使うとき |
|---|---|
| `make android-run` | Android Studio を開かずに, アプリをビルドして USB でつないだ端末に入れ, 起動する. 環境変数での指定は [setup.md](../environment/setup.md) の 9 |
| `make android-native` | Android Studio なしで, core と JNI が NDK でビルドできるかを確かめる |
| `make format` / `make format-check` | JNI の C++ (`android/app/src/main/cpp/`) を整形する / 整形を確かめる. core と同じ設定を使う ([../logic/usage.md](../logic/usage.md) の「コードの整形と検査」) |

Kotlin の検査のコマンドは [../development/android/kotlin.md](../development/android/kotlin.md) にある.

## 保存した画像を取り出す

Android アプリで「この画像を保存」を押すと, 解析した元の画像が端末の `Pictures/PokerChip/` に保存される.
PC と端末を USB でつなぎ ([setup.md](../environment/setup.md) の 8 の 5), 次のコマンドで `testimages/android/` に取り出す.

```
adb pull /sdcard/Pictures/PokerChip/. testimages/android/
```
