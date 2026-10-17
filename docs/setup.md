# セットアップ手順

新しいマシンでこのプロジェクトを使えるようにするまでの手順.
Linux で実験・テストをする部分 (1〜6) と, Android アプリをビルドする部分 (7〜9) がある.
セットアップが済んだ後の Linux マシンでの使い方 (ビルド, CLI の実行, テスト) は [usage.md](usage.md),
設計の理由は [architecture.md](architecture.md) を参照.

想定する環境は **Ubuntu 24.04** (作業記録の環境と同じ). 他のバージョンでも大きくは変わらないが,
clang-format / clang-tidy のバージョンが違うと整形結果や指摘が変わることがある.

## 0. 必要なもの

| 項目 | 目安 | 備考 |
|---|---|---|
| メモリ | 16GB 以上 | Android Studio とエミュレータを同時に動かすため |
| ディスクの空き | 40GB 以上 | Android SDK とエミュレータで約 15GB, OpenCV のビルドで約 4.5GB, Python の venv で約 6GB |
| sudo | 必要 | apt でのパッケージのインストール |
| KVM | エミュレータを使う場合 | `ls /dev/kvm` で存在を確認. BIOS で CPU の仮想化を有効にする |
| `best.pt` | 必須 | 学習済みの YOLO の重み. git 管理外なので別途受け取る (6 を参照) |

## 1. リポジトリを取得する

```
git clone git@github.com:akisatoon1/pokerchipsDetection.git ~/workspace/pokerchip
cd ~/workspace/pokerchip
```

## 2. apt でパッケージを入れる

```
sudo apt update
sudo apt install build-essential cmake git curl unzip python3-venv \
                 libgtk-3-dev clang-format clang-tidy
```

- `libgtk-3-dev` は OpenCV の画面表示 (`imshow`, 手動の ROI 選択) に必要.
  **OpenCV をビルドする (3) より前に入れておくこと.** 後から入れた場合は 3 をやり直す.
- CMake は 3.22 以上が必要 (Ubuntu 24.04 の apt 版は 3.28).

以降のコマンドはすべてリポジトリのルートで実行する.

## 3. OpenCV 4.14.0 をビルドする

Linux と Android で OpenCV のバージョンを揃えるため, apt の OpenCV は使わずにソースからビルドする.
`third_party/opencv-4.14.0/` にインストールされる (git 管理外).

```
make opencv        # = scripts/build_opencv.sh. 数分かかる
```

ビルドのログに `GTK+: YES` (GUI: GTK3) と出ていれば画面表示が使える. `NO` なら 1 の `libgtk-3-dev` が
入っていないので, 入れてから `make opencv` をやり直す.

## 4. Python の環境を作る

モデルを ONNX に変換するのと, 検出結果の基準を作るのに使う.

```
python3 -m venv .venv
.venv/bin/pip install -r pyscript/requirements.txt
```

PyTorch などを含むので, ダウンロードに時間がかかる (約 6GB).

## 5. ビルドとテスト

```
make build         # build/pokerchip (CLI) とテストをビルド
```

モデルがまだないので, この時点ではモデルを使うテストはスキップされる.

## 6. モデルを用意する

モデルは別リポジトリ (yoloPokerchip) で学習する. 重みは git 管理されていないので,
学習済みの `best.pt` を受け取ってリポジトリのルートに置く (`*.pt` は git 管理外).

```
make model PT=best.pt    # = scripts/export_model.sh
```

- `models/chip_detector.onnx` ができ, Android の assets (`android/app/src/main/assets/`) にもコピーされる.
- `models/VERSION` に変換元の `.pt` の sha256 が記録される.

ここまでで Linux 側の準備は終わり. 確認する:

```
make test          # 全テストが通ること (6 件)
make check         # clang-format と clang-tidy の指摘がないこと
make run ARGS="--out debug.png testimages/yoko/stack/singlecolor/IMG_5587.jpg"
```

最後のコマンドで `chip count by peaks  = 4` と黄色 4 枚が出て, `debug.png` が保存されれば OK.

ビルド, CLI のオプションや出力の見方, テスト, モデルを更新したときの手順などは [usage.md](usage.md) を参照.

## 7. Android 用の外部ファイルを取得する

```
make android-deps    # = scripts/fetch_android_deps.sh
```

- OpenCV Android SDK 4.14.0 を `third_party/opencv-4.14.0-android-sdk/` に取得する.
  アプリのビルド (`android/app/src/main/cpp/CMakeLists.txt`) がここを参照するので **必須**.
- NDK r30 を `third_party/android-ndk-r30/` に取得する. これは `make android-native`
  (Android Studio なしでの確認) 用. 不要なら `scripts/fetch_android_deps.sh --no-ndk`.

## 8. Android Studio を入れる

1. Android Studio をインストールする. どちらかの方法で:
   - `sudo snap install android-studio --classic`
   - 公式サイト (https://developer.android.com/studio) の tar.gz を展開し, `bin/studio.sh` を実行
2. 初回起動のウィザードで標準の SDK を入れる.
3. **SDK Manager** (Settings > Languages & Frameworks > Android SDK) で以下を入れる.
   バージョンは `android/app/build.gradle.kts` の指定と合わせる.
   アプリは Android 15 (API 35) 以上が対象で, Android 17 (API 37) の SDK でビルドする.
   - SDK Platforms: Android 17 (API 37)
   - SDK Tools: NDK (Side by side) `30.0.16248370` ("Show Package Details" で版を選ぶ)
   - SDK Tools: CMake `3.31.6`

   NDK と CMake は, SDK のライセンスに同意済み (`~/Android/Sdk/licenses/` がある) なら,
   初回の Gradle のビルドで自動で入る.
4. エミュレータを使う場合, KVM を使えるようにする.
   ```
   sudo adduser $USER kvm     # 反映には再ログインが必要
   ```
5. 実機を使う場合:
   - 端末で「開発者向けオプション」を有効にし, 「USB デバッグ」をオンにする.
   - PC 側で udev のルールを入れる.
     ```
     sudo apt install android-sdk-platform-tools-common
     sudo adduser $USER plugdev  # 反映には再ログインが必要
     ```
   - adb は 2 の標準 SDK に含まれる `platform-tools/` に入っている. コマンドラインで使えるように PATH を通す.
     ```
     echo 'export PATH="$HOME/Android/Sdk/platform-tools:$PATH"' >> ~/.bashrc   # SDK の場所は入れ方で変わる
     ```
   - USB で繋いで `adb devices` に端末が出れば OK.

## 9. アプリをビルドして動かす

1. 6 (モデル) と 7 (OpenCV Android SDK) が済んでいることを確認する.
   - `android/app/src/main/assets/chip_detector.onnx` がある
   - `third_party/opencv-4.14.0-android-sdk/` がある
2. Android Studio で **`android/` ディレクトリ** を開く (リポジトリのルートではない).
   Gradle の同期が走り, `android/local.properties` (SDK の場所) が自動で作られる.
3. 実機かエミュレータ (Android 15 以上, x86_64 のシステムイメージ) を選んで Run.

コマンドラインでビルドする場合:

```
cd android
export JAVA_HOME=/usr/local/android-studio/jbr   # Android Studio に入っている JDK. 場所は入れ方で変わる
./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk ができる
./gradlew installDebug           # 繋いだ端末にインストール
```

Android Studio を使わない場合は `android/local.properties` に `sdk.dir=/path/to/Android/Sdk` を書く.
Gradle 9 と AGP 9 を使うので, JDK 17 以上が要る.

### Linux と同じ結果になるかの確認

アプリで testimages の画像を読み込み, Linux の CLI と比べる.

```
./build/pokerchip --json --out /tmp/debug.png testimages/yoko/stack/singlecolor/IMG_5587.jpg
```

画像は `adb push testimages/yoko/stack/singlecolor/IMG_5587.jpg /sdcard/Pictures/` で端末に送り,
アプリの「ギャラリー」から選ぶ. 枠の位置・枚数・色が JSON と一致すれば OK.

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `OpenCV error: ... The function is not implemented` (imshow など) | OpenCV が GUI なしでビルドされている. `libgtk-3-dev` を入れて `make opencv` をやり直す. それまでは `--out` / `--rect` を使う |
| CMake で `Could not find a configuration file for package "OpenCV" that exactly matches requested version "4.14.0"` | `make opencv` (Linux) または `make android-deps` (Android) をしていない. または別のバージョンの OpenCV を掴んでいる |
| `make test` で検出器のテストがスキップされる | `models/chip_detector.onnx` がない. 6 を行う |
| `make test` で検出器のテストが失敗する | モデルと基準 (`tests/data/yolo_reference.txt`) が合っていない. [usage.md](usage.md) の「モデルを更新したとき」を参照 |
| Gradle で `SDK location not found` | `android/local.properties` に `sdk.dir` がない. Android Studio で開けば自動で作られる |
| Gradle で NDK や CMake が見つからない | 8-3 のバージョンの NDK / CMake を SDK Manager で入れる |
| アプリで解析すると `chip_detector.onnx` が開けないというエラーになる | assets にモデルがない. `make model PT=...` をやり直す (`android/app/src/main/` がある状態で実行すると assets にもコピーされる) |
| エミュレータが起動しない / 非常に遅い | KVM が使えていない. `ls -l /dev/kvm` と `groups` に `kvm` があるかを確認 |
