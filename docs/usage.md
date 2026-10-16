# Linux マシンでの使い方

Linux マシンでのビルド, CLI の実行, テスト, コードの検査の方法.
環境構築 (apt, OpenCV, Python, モデルの用意) が済んでいることが前提で, その手順は [setup.md](setup.md) の 1〜6 にある.
Android アプリのビルドは [setup.md](setup.md) の 7〜9 を参照.

コマンドはすべて **リポジトリのルートで** 実行する. CLI もテストも, モデル (`models/chip_detector.onnx`) や
テスト画像をリポジトリのルートからの相対パスで探すため.

## ビルド

```
make build         # build/pokerchip (CLI) と build/tests/pokerchip_tests をビルド
```

- 初回は `cmake -S . -B build` で設定してからビルドする. 2 回目以降は変更のあったところだけビルドされる.
- ビルドの種類は既定で `Release`.
- OpenCV は `third_party/opencv-4.14.0/` (`make opencv` でビルドしたもの) を使う.
  システムの OpenCV は使わない.
- テストのビルドには GoogleTest を使い, 初回の設定のときにダウンロードされる.
- やり直したいときは `make clean` で `build/` を消してから `make build`.

## CLI を実行する

```
./build/pokerchip [オプション] <画像のパス>
make run ARGS="[オプション] <画像のパス>"     # ビルドしてから実行する
```

`make run` で `ARGS` を省略すると `testimages/yoko/stack/singlecolor/IMG_5587.jpg` を解析する.

### オプション

| オプション | 意味 |
|---|---|
| `--roi yolo` (既定) | YOLO で画像の中のスタックを検出する. 見つかったスタックをすべて解析する |
| `--roi user` | 画面で ROI を手動で選ぶ (GUI 必須). ドラッグで囲み, Enter か Space で確定, `c` で取り消し |
| `--rect X,Y,W,H` | ROI を数値で指定する (元画像のピクセル座標). 同じ ROI で実験を繰り返すとき用. `--roi` より優先 |
| `--model PATH` | ONNX のパス (既定 `models/chip_detector.onnx`) |
| `--out PATH` | デバッグ画像をファイルに保存する. 省略時は画面に表示する (GUI 必須) |
| `--json` | 結果を JSON でも出力する (Android と同じ形式) |

GUI なしでビルドした OpenCV では, `--out` を付けずに実行したり `--roi user` を使ったりするとエラーになる.

### 例

```
# YOLO で検出し, 結果を JSON でも出し, デバッグ画像を保存する
./build/pokerchip --json --out debug.png testimages/yoko/stack/singlecolor/IMG_5587.jpg

# 同じ領域で繰り返し試す (上の結果の ROI をそのまま指定)
./build/pokerchip --rect 1089,1246,916,831 --out debug.png testimages/yoko/stack/singlecolor/IMG_5587.jpg

# 手動で ROI を選び, デバッグ画像を画面に表示する
./build/pokerchip --roi user testimages/yoko/stack/singlecolor/IMG_5587.jpg
```

### 出力

スタックごとに, 解析の途中の値と結果が出る. スタックが複数あるときは左のスタックから順に `[stack 0]`, `[stack 1]`, ... となる.

```
[stack 0] ROI: [916 x 831 from (1089, 1246)], score = 0.969136
  autocorrelation: period = 163 px
  profile length = 831 px
  detected seams = 5
  chip count by peaks  = 4
  chip colors (top -> bottom) = yellow, yellow, yellow, yellow
{"stacks":[{"box":[1089,1246,916,831],"score":0.969136,"count":4,"colors":["yellow","yellow","yellow","yellow"]}]}
Saved debug view: debug.png
```

| 行 | 意味 |
|---|---|
| `ROI` | スタックの領域. 幅 x 高さ と左上の座標 (元画像のピクセル) |
| `score` | YOLO の検出スコア. `--roi user` と `--rect` では 1 |
| `autocorrelation: period` | 縦方向のプロファイルの自己相関から求めた, チップ 1 枚あたりの高さの目安 |
| `profile length` | プロファイルの長さ (= ROI の高さ) |
| `detected seams` | 見つかったチップの境目の数 |
| `chip count by peaks` | 枚数 (境目と境目の間の数) |
| `chip colors` | 上のチップから順の色. `red`, `blue`, `yellow`, `black`, `gray`, `purple`, `green` のいずれか |

`--json` を付けたときの JSON の各項目:

| キー | 内容 |
|---|---|
| `stacks` | スタックの配列 (左から順) |
| `box` | `[x, y, 幅, 高さ]` (元画像のピクセル) |
| `score` | 検出スコア |
| `count` | 枚数 |
| `colors` | 上のチップから順の色 |

枚数を数えられなかったスタックは `Failed to count chips.` と出て, デバッグ画像も作られない.
スタックが 1 つも検出されなかった場合は `Error: ROI was not selected.` と出て終了コード 1 で終わる.

### デバッグ画像

左から順に, ROI の切り出し, 縦方向のプロファイルのグラフ, チップごとの色のラベルが並ぶ.
横線 (オレンジ) が見つかった境目. 高さが 900px を超える場合は縮小される.

`--out` でスタックが複数あるときは, ファイル名に番号が付く (`debug_0.png`, `debug_1.png`, ...).

### testimages をまとめて解析する

```
for f in testimages/yoko/stack/*/*.jpg testimages/yoko/single/*.jpg; do
  echo "$f $(./build/pokerchip --json --out /tmp/debug.png "$f" 2>&1 | grep -E '^\{|^Error')"
done > results.txt
```

1 行に「画像のパス + JSON かエラー」が並ぶ. 今のモデルでは, 27 枚のうち 5 枚はスタックが検出されず
`Error: ROI was not selected.` になる. モデルや処理を変えたときに, 前の結果と `diff` で比べるのに使う.

## テスト

```
make test          # ビルドしてから ctest を実行する
```

テストは 6 件 (`tests/test_pipeline.cpp`, `tests/test_detector.cpp`).
1 件だけ動かすときは ctest の `-R` で名前を指定する.

```
ctest --test-dir build -N                        # テストの一覧
ctest --test-dir build -R YoloDetector --output-on-failure
```

- `models/chip_detector.onnx` がないと, 検出器のテスト (`YoloDetector.*`) はスキップされる.
- 検出器のテストは「ultralytics で同じ ONNX を推論した結果」(`tests/data/yolo_reference.txt`) を基準にしている.

### モデルを更新したとき

モデルを更新したら基準を作り直し, テストが通ることを確かめてからコミットする.

```
make model PT=path/to/new/best.pt
.venv/bin/python pyscript/make_yolo_reference.py models/chip_detector.onnx
make test
```

`make model` は `models/chip_detector.onnx` を作り, Android の assets にもコピーし,
`models/VERSION` に変換元の `.pt` の sha256 を記録する.

## コードの整形と検査

```
make format        # clang-format で整形する
make tidy-fix      # clang-tidy で自動修正してから整形する
make check         # 整形の確認 (format-check) と clang-tidy の検査. コミット前に通す
```

- 対象は `core/`, `cli/` (clang-tidy) と, それに加えて `tests/`, `android/app/src/main/cpp/` (clang-format).
- 設定はリポジトリのルートの `.clang-format` と `.clang-tidy`.

## make のターゲット一覧

| ターゲット | 内容 |
|---|---|
| `make build` | CMake の設定とビルド |
| `make run ARGS="..."` | CLI を実行 |
| `make test` | テスト (ctest) |
| `make format` / `make format-check` | clang-format で整形 / 整形の確認 |
| `make tidy` / `make tidy-fix` | clang-tidy で検査 / 自動修正 |
| `make check` | `format-check` と `tidy` |
| `make clean` | `build/` を削除 |
| `make opencv` | OpenCV のビルド (環境構築. [setup.md](setup.md) の 3) |
| `make model PT=...` | `.pt` を ONNX に変換 (環境構築. [setup.md](setup.md) の 6) |
| `make android-deps` | OpenCV Android SDK と NDK の取得 ([setup.md](setup.md) の 7) |
| `make android-native` | core + JNI を NDK でビルドできるかの確認 |
