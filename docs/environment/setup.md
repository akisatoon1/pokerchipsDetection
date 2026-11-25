# セットアップ手順

このプロジェクトを使えるようにする手順. 用意するものは 2 種類あり, 用意の仕方が違う.

| 種類 | 例 | 用意の仕方 |
|---|---|---|
| [1. マシンに 1 回だけ入れるもの](#1-マシンに-1-回だけ入れるもの) | apt のパッケージ, Android Studio と SDK, Node.js, gh | 手で入れる. sudo や人の操作 (SDK のライセンスへの同意など) が要り, ほかのプロジェクトにも効くため |
| [2. clone ごとに作るもの](#2-clone-ごとに作るもの-make-setup) | `third_party/` の OpenCV, `.venv/`, モデル, `android/local.properties`, `web/node_modules/` | `make setup` が作る |

2 はリポジトリの中に置く git の管理外のものなので, clone し直すとなくなる. 1 が済んだマシンでも, clone したら `make setup` を流す.

セットアップが済んだ後の使い方は [../logic/usage.md](../logic/usage.md) (CLI とテスト), [../android/usage.md](../android/usage.md) (Android),
[../web/running.md](../web/running.md) (Web) に, 設計の理由は [../architecture.md](../architecture.md) にある.

想定する環境は **Ubuntu 24.04**. 他の版でも大きくは変わらないが, clang-format と clang-tidy の版が違うと, 整形の結果や指摘が変わることがある.

## 0. 必要なもの

| 項目 | 目安 | 備考 |
|---|---|---|
| メモリ | 16GB 以上 | Android Studio とエミュレータを同時に動かすため |
| ディスクの空き | 40GB 以上 | Android SDK とエミュレータで約 15GB, OpenCV で約 4.5GB, Python の venv で約 6GB, Emscripten で約 1.7GB |
| sudo | 必要 | apt でパッケージを入れるため |
| KVM | エミュレータを使う場合 | `ls /dev/kvm` で確かめる. BIOS で CPU の仮想化を有効にする |
| 重み (`best.pt`) | 任意 | 学習済みの YOLO の重み. git の管理外なので別に受け取る. なければモデルを GitHub Release から取る (gh が要る) |

## 1. マシンに 1 回だけ入れるもの

`make setup` は, これらがあるかを確かめ, 足りなければすべてと入れ方を出して止める. 自分では入れない.
Android や Web を使わないなら, その部分は要らない (`scripts/setup.sh --skip-android --skip-web`).

### apt のパッケージと Git LFS

```
sudo apt update
sudo apt install build-essential cmake git git-lfs curl unzip pkg-config python3-venv \
                 libgtk-3-dev clang-format clang-tidy
git lfs install
```

- `libgtk-3-dev` は OpenCV の画面表示 (`imshow`, 手で ROI を選ぶ) に要る. `make setup` が OpenCV をビルドする前に入れておく.
  後から入れたときは, 「[作り直すとき](#作り直すとき)」のとおり OpenCV を作り直す.
- CMake は 3.22 以上が要る (Ubuntu 24.04 の apt の版は 3.28).
- `git lfs install` は, ユーザーの git の設定に Git LFS を組み込む. `testimages/` のデータセットの画像は Git LFS にあり
  ([../development/testimages.md](../development/testimages.md)), 組み込む前に clone すると, 画像の場所には中身ではなく短いテキスト (ポインタ) ができる.
  `make setup` が `git lfs pull` で本物の画像に置き換える.

### Android Studio と SDK (Android を使うとき)

1. Android Studio を入れる. どちらかの方法で:
   - `sudo snap install android-studio --classic`
   - 公式のサイト (https://developer.android.com/studio) の tar.gz を `/usr/local/android-studio` に展開し, `bin/studio.sh` を実行する
2. 初回の起動のウィザードで, 標準の SDK を入れる (`~/Android/Sdk`). SDK のライセンスにもここで同意する.
3. **SDK Manager** (Settings > Languages & Frameworks > Android SDK) で, `android/app/build.gradle.kts` に書いた版を入れる.
   アプリは Android 15 (API 35) 以上が対象で, Android 17 (API 37) の SDK でビルドする.
   - SDK Platforms: Android 17 (API 37) (`compileSdk`)
   - SDK Tools: NDK (Side by side) `30.0.16248370` (`ndkVersion`. "Show Package Details" で版を選ぶ)
   - SDK Tools: CMake `3.31.6` (`externalNativeBuild` の `version`)
4. エミュレータを使う場合, KVM を使えるようにする.
   ```
   sudo adduser $USER kvm     # 反映には再ログインが要る
   ```
5. 実機を使う場合:
   - 端末で「開発者向けオプション」を有効にし, 「USB デバッグ」をオンにする.
   - adb は 2 の SDK の `platform-tools/` に入っている. コマンドラインで使えるように PATH を通す.
     ```
     echo 'export PATH="$HOME/Android/Sdk/platform-tools:$PATH"' >> ~/.bashrc
     ```
   - USB で繋いで `adb devices` に端末が出れば OK.
     USB の権限は systemd (258 以降) の udev のルールが与えるので, udev のルールを別に入れなくてよい.

JDK は Android Studio に入っているもの (`/usr/local/android-studio/jbr`) を使う. Gradle 9 と AGP 9 を使うので, JDK 17 以上が要る.
JDK や SDK が上と違う場所にあるときは, `JAVA_HOME` と `ANDROID_HOME` に入れてから `make setup` を流す.

### Node.js 24 (Web を使うとき)

`web/package.json` の `engines` の版を使う. 公式の tarball を `~/.local/node` に入れる. sudo は要らない.
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

### GitHub CLI (重みがないとき)

重み (`best.pt`) がないとき, `make setup` は本番と同じモデルを GitHub Release から取る. そのときに使う.

```
sudo apt install gh
gh auth login
```

## 2. clone ごとに作るもの (`make setup`)

```
git clone git@github.com:akisatoon1/pokerchipsDetection.git
cd pokerchipsDetection
make setup
```

- 重みを受け取っているなら, `make setup` の前にリポジトリのルートに `best.pt` として置く. 別の場所なら `make setup PT=path/to/best.pt`.
- 何回流してもよい. もうあるものは飛ばす. 途中で失敗しても, 直してから流し直せば続きから進む.
- 初めての 1 回は, ダウンロードとビルドで数十分かかる.
- Android や Web を使わないなら, `scripts/setup.sh --skip-android` や `scripts/setup.sh --skip-web` で, その部分を飛ばす.

順に次を作る. 中身は `scripts/setup.sh` にあり, 各段は表のスクリプトを呼ぶ.

| 段 | 作るもの | 中で行うこと |
|---|---|---|
| Linux | テスト画像 (`testimages/` の LFS の画像) | `git lfs pull` |
| | `third_party/opencv-4.14.0/` | `scripts/build_opencv.sh`. Linux と Android, Web で版を揃えるため, apt の OpenCV は使わずソースからビルドする |
| | `.venv/` | `python3 -m venv .venv` と `pip install -r pyscript/requirements.txt`. モデルの書き出しと色の基準色の計算に使う |
| | `build/pokerchip` (CLI) | `make build` |
| モデル | `models/chip_detector.onnx` | 重みがあれば `scripts/export_model.sh` で書き出し, なければ `scripts/fetch_model.sh` で `models/model.lock` の Release から取る |
| Android | `third_party/opencv-4.14.0-android-sdk/` | `scripts/fetch_android_deps.sh` |
| | `android/local.properties` | SDK の場所 (`sdk.dir`) を書く. Gradle と Android Studio が SDK を探すのに使う |
| Web | `web/node_modules/` | `npm ci` |
| | `third_party/emsdk/` (Emscripten 6.0.13) | `scripts/fetch_emsdk.sh` |
| | `third_party/opencv-4.14.0-wasm/` | `scripts/build_opencv_wasm.sh` |
| | `web/src/client/public/detector/` (検出器) | `scripts/build_wasm.sh`. core を WASM にし, モデルと一緒に置く |

Android のアプリは, ビルドのときに `models/chip_detector.onnx` を assets に入れる (`android/app/build.gradle.kts`). assets に写す手順はない.

### 作り直すとき

`make setup` は, もうあるものを作り直さない. 作り直すには, そのものを消してから `make setup` を流す.

| したいこと | すること |
|---|---|
| OpenCV を作り直す (`libgtk-3-dev` を後から入れたときなど) | `rm -rf third_party/opencv-4.14.0 build` → `make setup` |
| モデルを `models/model.lock` の Release から取り直す | `rm models/chip_detector.onnx` → `make setup` |
| 新しい重みからモデルを書き出す | `make model PT=path/to/best.pt` ([../logic/usage.md](../logic/usage.md) の「モデルを更新したとき」) |
| core やモデルを変えたあと, 検出器を作り直す | `scripts/build_wasm.sh` ([../logic/usage.md](../logic/usage.md) の「WASM」). `make web-dev` は起動の前にこれを流す |
| `web/package.json` が変わったあと, パッケージを入れ直す | `cd web && npm ci` |

## 3. 動くか確かめる

```
make test          # 全体テストが最後まで流れ, 画像ごとの結果が出ること
make check         # clang-format と clang-tidy の指摘がないこと
make run ARGS="--out debug.png testimages/v1/yoko/stack/singlecolor/IMG_5587.jpg"
```

最後のコマンドで, スタックの枚数 (`chip count by peaks`) と色が出て, `debug.png` が保存されれば OK.

- Android: 端末を USB で繋いで `make android-run` を流し, アプリが起動すれば OK ([../android/usage.md](../android/usage.md)).
  Android Studio で開くときは, リポジトリのルートではなく **`android/` ディレクトリ** を開く.
- Web: `make web-dev` で起動し, ブラウザで http://localhost:8787 を開く ([../web/running.md](../web/running.md)).

## 別のマシンへ移る

- 持っていくのは重み (`best.pt`) だけ. コードと画像は git (GitHub) で持っていき, それ以外は移った先の `make setup` で作り直す.
  `third_party/` や `.venv/` は, マシンに依るビルドの結果とダウンロードしたものなので持っていかない.
- 移る前に, 作業中の変更をすべてコミットして push する.
- 移った先で `make test` の結果が, 移る前と同じになることを確かめる. 作り直したモデルが同じかの確かめにもなる.

## トラブルシューティング

| 症状 | 原因と対処 |
|---|---|
| `OpenCV error: ... The function is not implemented` (imshow など) | OpenCV が GUI なしでビルドされている. `libgtk-3-dev` を入れ, 「[作り直すとき](#作り直すとき)」のとおり OpenCV を作り直す. それまでは `--out` / `--rect` を使う |
| CMake で `Could not find a configuration file for package "OpenCV" that exactly matches requested version "4.14.0"` | `make setup` をしていない (clone し直したときも要る). または別の版の OpenCV を掴んでいる |
| `make test` で CLI が失敗したと出る | モデルがない, または画像が LFS のポインタのまま. `make setup` を流す |
| Gradle で `SDK location not found` | `android/local.properties` がない. `make setup` を流す |
| Gradle で `copyDebugModelToAssets` の `models/chip_detector.onnx ... doesn't exist` | モデルがない. `make setup` を流す |
| Gradle で NDK や CMake が見つからない | 「[Android Studio と SDK](#android-studio-と-sdk-android-を使うとき)」の 3 の版を SDK Manager で入れる |
| `scripts/build_wasm.sh` で OpenCV が見つからない | `make setup` をしていない. `--skip-web` で流していたなら, 付けずに流す |
| `adb devices` で端末が `no permissions` になる | udev のルールが ADB の端末を知らない (systemd が 258 より古い OS など). `sudo apt install android-sdk-platform-tools-common` でルールを入れ, 端末を挿し直す |
| エミュレータが起動しない / 非常に遅い | KVM が使えていない. `ls -l /dev/kvm` と `groups` に `kvm` があるかを確かめる |
