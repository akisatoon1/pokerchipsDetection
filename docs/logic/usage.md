# ロジック, CLI の使い方

Linux マシンでの core と CLI のビルド, CLI の実行, テスト, WASM のビルドと比べ, コードの検査の方法.
環境構築 (apt, OpenCV, Python, モデルの用意) が済んでいることが前提で, その手順は [setup.md](../environment/setup.md) の 1〜6 にある.
WASM の用意は [setup.md](../environment/setup.md) の 10 を, Android アプリの使い方は [../android/usage.md](../android/usage.md) を参照.

コマンドはすべて **リポジトリのルートで** 実行する. CLI もテストも, モデル (`models/chip_detector.onnx`) や
テスト画像をリポジトリのルートからの相対パスで探すため.

## make のコマンド

よく使う操作は, ルートの `Makefile` にまとめてあり `make` で呼べる. ここにはロジックの作業で使うものを, 何をしたいときに使うかだけ書く.
各コマンドが実際に何を実行するか (呼ぶスクリプト, 引数の既定値, 検査の対象のファイル) は `Makefile` を見る.
環境構築のもの (`make opencv`, `make model`, `make android-deps`) は [setup.md](../environment/setup.md) に,
Android のもの (`make android-run`, `make android-native`) は [../android/usage.md](../android/usage.md) にある.

| コマンド | 使うとき |
|---|---|
| `make build` | CLI (`build/pokerchip`) をビルドする |
| `make run ARGS="..."` | ビルドしてから CLI を実行する (下の「CLI を実行する」) |
| `make test` | ロジックを変えたあと, 正解付きの画像で結果が崩れていないかを確かめる (下の「テスト」) |
| `make format` | C++ を整形する |
| `make tidy-fix` | clang-tidy の指摘を自動で直してから整形する |
| `make check` | コミットの前に, 整形の確認と clang-tidy の検査を通す. 片方だけなら `make format-check`, `make tidy` |
| `make clean` | ビルドをやり直す. `build/` を消すので, 次に `make build` する |

## ビルド

`make build` で CLI (`build/pokerchip`) をビルドする.

- ビルドの種類は既定で `Release`.
- OpenCV は `third_party/opencv-4.14.0/` (`make opencv` でビルドしたもの) を使う.
  システムの OpenCV は使わない.

## CLI を実行する

```
./build/pokerchip [オプション] <画像のパス>
make run ARGS="[オプション] <画像のパス>"     # ビルドしてから実行する
```

### オプション

| オプション | 意味 |
|---|---|
| `--roi yolo` (既定) | YOLO で画像の中のスタックを検出する. 奥に写ったスタック (いちばん広い箱より十分に狭いもの) を除き, 残りをすべて解析する |
| `--roi user` | 画面で ROI を手動で選ぶ (GUI 必須). ドラッグで囲み, Enter か Space で確定, `c` で取り消し |
| `--rect X,Y,W,H` | ROI を数値で指定する (元画像のピクセル座標). 同じ ROI で実験を繰り返すとき用. `--roi` より優先 |
| `--model PATH` | ONNX のパス (既定 `models/chip_detector.onnx`) |
| `--out PATH` | デバッグ画像をファイルに保存する. 省略時は画面に表示する (GUI 必須) |
| `--json` | 結果を JSON でも出力する (Android と同じ形式) |
| `--lab` | チップごとの代表色 (照明を補正したあとの Lab) も出力する. 色の基準色を作り直すときと, 色の誤りを調べるとき用 |

GUI なしでビルドした OpenCV では, `--out` を付けずに実行したり `--roi user` を使ったりするとエラーになる.

### 例

```
# YOLO で検出し, 結果を JSON でも出し, デバッグ画像を保存する
./build/pokerchip --json --out debug.png testimages/v1/yoko/stack/singlecolor/IMG_5587.jpg

# 同じ領域で繰り返し試す (上の結果の ROI をそのまま指定)
./build/pokerchip --rect 1089,1246,916,831 --out debug.png testimages/v1/yoko/stack/singlecolor/IMG_5587.jpg

# 手動で ROI を選び, デバッグ画像を画面に表示する
./build/pokerchip --roi user testimages/v1/yoko/stack/singlecolor/IMG_5587.jpg
```

### 出力

スタックごとに, 解析の途中の値と結果が出る. スタックが複数あるときは左のスタックから順に `[stack 0]`, `[stack 1]`, ... となる.

```
[stack 0] ROI: [916 x 831 from (1089, 1246)], score = 0.969136
  autocorrelation: period = 81 px
  profile length = 831 px
  detected seams = 11
  chip count by peaks  = 10
  chip colors (top -> bottom) = yellow, yellow, yellow, yellow, yellow, yellow, yellow, yellow, yellow, yellow
{"stacks":[{"box":[1089,1246,916,831],"score":0.969136,"count":10,"peaks":[6,92,174,258,340,420,501,582,667,745,821],"colors":["yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow","yellow"]}]}
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
| `chip lab` | `--lab` を付けたときだけ出る. 上のチップから順の代表色 `(L, a, b)` |

`--json` を付けたときの JSON の各項目:

| キー | 内容 |
|---|---|
| `stacks` | スタックの配列 (左から順) |
| `box` | `[x, y, 幅, 高さ]` (元画像のピクセル) |
| `score` | 検出スコア |
| `count` | 枚数 |
| `peaks` | チップの合わせ目の y. 元画像でなく ROI の上端からのピクセル. Android で区切り線を描くのに使う |
| `colors` | 上のチップから順の色 |

枚数を数えられなかったスタックは `Failed to count chips.` と出て, デバッグ画像も作られない.
スタックが 1 つも検出されなかった場合は `Error: ROI was not selected.` と出て終了コード 1 で終わる.

### デバッグ画像

左から順に, ROI の切り出し, 縦方向のプロファイルのグラフ, チップごとの色のラベルが並ぶ.
横線 (オレンジ) が見つかった境目. 高さが 900px を超える場合は縮小される.

`--out` でスタックが複数あるときは, ファイル名に番号が付く (`debug_0.png`, `debug_1.png`, ...).

### testimages をまとめて解析する

```
for f in testimages/v1/yoko/stack/*/*.jpg testimages/v1/yoko/single/*.jpg; do
  echo "$f $(./build/pokerchip --json --out /tmp/debug.png "$f" 2>&1 | grep -E '^\{|^Error')"
done > results.txt
```

1 行に「画像のパス + JSON かエラー」が並ぶ. 今のモデルと検出のしきい値 (0.9) では, `stack/` の 27 枚のうち 4 枚 (どれも 3 枚のスタック) と
`single/` の 3 枚はスタックが検出されず `Error: ROI was not selected.` になる. モデルや処理を変えたときに, 前の結果と `diff` で比べるのに使う.

## テスト

```
make test                                                 # 決まったデータセットすべてで全体テストを流す
make test TEST_DATASETS=testimages/v2/yoko/single_color   # 1 つのデータセットだけ流す
```

流すデータセットは Makefile の `TEST_DATASETS` で決まる. データセットごとに `== <データセット>` の見出しと結果が出る.

テストは全体テスト (`functional_tests/evaluate.py`) だけにしている.
正解付きのデータセットの画像を CLI で解析し, 画像ごとに正解か不正解かを出す. ロジックを変えたときに, 今の画像での結果が崩れていないかを確かめる.
関数ごとの単体テストは置かない. 全体テストで原因の場所が分からなくなったときに足す.

```
python3 functional_tests/evaluate.py testimages/v2/yoko/single_color
python3 functional_tests/evaluate.py <データセット> --cli <CLI のパス> --model <ONNX のパス>   # 既定と違う場所のものを使う
```

- データセットは `answers.jsonl` のあるディレクトリ ([../development/testimages.md](../development/testimages.md)). 正解の形式は v2 のすべてのデータセットで同じ.
- 正解のスタックには位置がないので, 正解と見つかったスタックを, 間違えたスタックがいちばん少ない組み合わせで突き合わせる.
  同じ数なら, 枚数の差の合計が小さい組み合わせをとる.
- CLI の既定は `build/pokerchip`, モデルの既定は `models/chip_detector.onnx`. 先に `make build` をしておく.
- 正解の画像は `OK`, 不正解の画像は `NG` と, 最初に間違えた段を 1 つ出す. 前の段が違うと後の段は比べられないため.

```
OK  images/PXL_20261123_093717714.MP.jpg
NG  images/PXL_20261123_093705462.jpg  スタック: 正解 1 個, 見つからない
NG  images/PXL_20261123_094659670.jpg  色: 9 枚目 期待:blue, 間違い:black, 20 枚目 期待:blue, 間違い:black
正解 30/35
```

スタックが 2 つ以上の画像では, 間違えたスタックを `左から 1 本目 計数: 正解 21, 結果 20` のように示す.

| 段 | 不正解になるとき |
|---|---|
| スタック | 見つかったスタックの数が正解と違う |
| 計数 | 枚数が正解 (`colors` の要素の数) と違う. 数えられなかったときは「数えられない」 |
| 色 | 色が違うチップがある. 上から何枚目かを, 違うものすべて並べる |

- 不正解があっても終了コードは 0. 結果を見るための道具で, 今のロジックにも不正解があるため. CLI が失敗したときだけ 0 以外で終わる.

### 色の基準色を作り直すとき

チップセットを変えたときや, 色判定の補正の処理を変えたときは, 基準色を作り直す.

```
make build
.venv/bin/python pyscript/make_color_references.py
```

`answers.txt` の画像を CLI の `--lab` で解析し, 正解の色ごとに代表色の中央値をとって,
`kReferences` の初期化子 (C++) を出力する. これを `core/src/color.cpp` に貼り付けてから `make test` で結果を確かめる.
検出できなかった画像や枚数が正解と合わない画像は, チップと色の対応が取れないので使わない (標準エラー出力に出る).

### モデルを更新したとき

モデルを更新したら, 全体テストの結果が前より悪くなっていないかを確かめてからコミットする.

```
make model PT=path/to/new/best.pt   # 何ができるかは setup.md の 6
make test
```

モデルは git に入れない. 使うと決めたら `scripts/release_model.sh` で GitHub Release に置き,
書き換わった `models/model.lock` をコミットする. push すると Web にも出る ([../web/deploy.md](../web/deploy.md) の「モデルを替える」).

## WASM

Web の画面で動かす core (WASM) のビルドと, Linux の CLI と結果が同じかの確かめ方.
Emscripten と WASM 用の OpenCV の用意 ([setup.md](../environment/setup.md) の 10) が済んでいることが前提.

```
scripts/build_wasm.sh                     # build-wasm/ でビルドし, .js, .wasm, モデルを web/src/client/public/detector/ に置く
functional_tests/compare_wasm_cli.sh      # testimages/v2/yoko/ の画像を WASM と CLI で解析して比べる
functional_tests/compare_wasm_cli.sh testimages/v1/yoko/stack/multicolor_jpg/IMG_5720.jpg   # 画像を選んで比べる
```

- 比べる前に `make build` と `scripts/build_wasm.sh` をしておく. WASM は Node で動かす.
- 比べに使う画像は `testimages/v2/yoko/` だけにする (人が決めた決まり). 画像を省略すると, ここの画像をすべて使う.
  全部の testimages (約 250 枚) では 4〜5 分かかるのに対し, 35 枚なので短く済む.
- スタックの数, box, count, peaks, colors が一致し, score の差が 0.001 以内なら一致とする. 違う画像は, どの値が違うかを出す.
  空の画像, 大きさの合わない画素, 壊れたモデルを渡すと落ちずにエラーの文が返ること, 各ファイルが 25 MiB 以下であることも確かめる.
- 1 枚でも違えば終了コード 1 で終わる. Emscripten や OpenCV の版, `wasm/` の設定を変えたら, push の前に流す.
  CI は検出器をビルドするだけで, この比べはしないため. core やモデルの変更では, 同じソースとモデルを使うのでずれない.
- WASM に渡す画素は, CLI と同じ `cv::imread` で読む小さな道具 (`functional_tests/decode_rgba.cpp`) で作る. ブラウザの画像の読み方の違いは含まない.

### Web に出す

デプロイの CI が, push のたびに検出器 (core + wasm + モデル) をビルドする. core や `wasm/` の変更は, push すれば Web にも出る.
モデルを替えるときだけ, 手で Release を作る. 手順は [../web/deploy.md](../web/deploy.md) の「モデルを替える」にある.

## コードの整形と検査

`make format`, `make tidy-fix`, `make check` を使う (上の「make のコマンド」). コミットの前に `make check` を通す.

- 対象のファイルは Makefile の `SRCS`, `HDRS`, `JNI_SRCS` で決まる.
  `wasm/` と `functional_tests/` の C++ は入っていないので, 変えたら `clang-format -i <ファイル>` で整形する.
- 設定はリポジトリのルートの `.clang-format` と `.clang-tidy`.
