# ロジックの設計判断の記録 (ADR)

ロジック (`core/`) のパラメータや方式を, データを見て決めたときの記録.
決めたこと, 理由, 根拠のデータを残す. 新しい記録は末尾に足し, 決めたことを後で変えたら新しい記録を足して, 古い記録の「状態」を直す.

## ADR-1: 検出のしきい値を 0.9 にする

- 日付: 2026-11-23
- 状態: 採用 (コミット `fc3f944`)
- 対象: `DetectorConfig::scoreThreshold` (`core/include/pokerchip/detector.hpp`). `pyscript/make_yolo_reference.py` の `CONF` も合わせる (このスクリプトは 2026-11-23 に検出器のテストと一緒に消した)

### 背景

YOLO の検出スコア (検出の信頼度) が 0.5 以上なら, すべてスタックとして数えていた.
信頼できない検出で数えないよう, しきい値をどこまで上げられるかを調べた.

### 決めたこと

しきい値を 0.5 から 0.9 に上げる.

### 理由

- 5 枚以上のスタックは全部検出され, スコアの最低は 0.955 だった. 0.9 なら余裕を持って通る.
- 0.95 にすると最低の 0.955 との差がほとんどなく, 撮り方が少し変わるだけで 5 枚以上のスタックを落としうる.
- 5 枚未満 (どれも 3 枚) のスタックはスコアが低く, ばらつく (0.69〜0.97, 2 枚は検出なし).

### 根拠のデータ

- 画像: `testimages/v1/yoko/stack/` の 27 枚 (`singlecolor` 11 枚, `multicolor_jpg` 16 枚). どの画像もスタックは 1 つ.
- モデル: `models/chip_detector.onnx` (`models/VERSION` の `sha256(pt)` が `691a36e3...`, 2026-10-17 に変換したもの).
- スコア: しきい値 0.5 のときの CLI (`./build/pokerchip --json`) の `score`.
- 画像ごとの値: [data/detection-scores-singlecolor.tsv](data/detection-scores-singlecolor.tsv),
  [data/detection-scores-multicolor.tsv](data/detection-scores-multicolor.tsv).
  列は `score`, `image`, `stack` (左からの番号). 検出されなかった画像は `score` が `none`.
- 枚数: `multicolor_jpg` は `answers.txt` の正解. `singlecolor` は正解がないので core が数えた枚数
  (`multicolor_jpg` では, 検出できた 15 枚すべてで core の枚数が正解と合った). `IMG_5593.jpg` は検出されないので, 画像を目で見て 3 枚とした.

5 枚以上 (19 枚):

| 枚数 | 画像の数 | スコアの最低 | 中央値 | 最高 |
|---|---|---|---|---|
| 5 枚 | 2 | 0.955 | - | 0.966 |
| 10〜20 枚 | 17 | 0.969 | 0.984 | 0.989 |
| 合計 | 19 | **0.955** | 0.983 | 0.989 |

5 枚未満 (8 枚. すべて 3 枚):

| スコア | 画像 |
|---|---|
| 検出なし | `multicolor_jpg/IMG_5719.jpg` |
| 0.906 | `multicolor_jpg/IMG_5720.jpg` |
| 0.937 | `multicolor_jpg/IMG_5721.jpg` |
| 0.968 | `multicolor_jpg/IMG_5722.jpg` |
| 0.958 | `singlecolor/IMG_5590.jpg` |
| 0.864 | `singlecolor/IMG_5591.jpg` |
| 0.691 | `singlecolor/IMG_5592.jpg` |
| 検出なし | `singlecolor/IMG_5593.jpg` |

### 結果

- 0.9 にしたあと, 27 枚のうち検出されないのは 4 枚 (`IMG_5719`, `IMG_5591`, `IMG_5592`, `IMG_5593`. どれも 3 枚のスタック) になった.
  5 枚以上のスタックは全部検出される.
- `testimages/v1/yoko/single/` の 1 枚だけの画像 3 枚は検出されない.

### 注意

- 画像が 27 枚と少なく, 撮り方 (真横から, 同じ机) もそろっている. 違う撮り方の写真では分布が変わりうる.
- これらの画像が YOLO の学習に使われていれば, スコアは実際より高く出ている. 学習に使ったかは, このリポジトリからは分からない.
- スコアはモデルで変わる. モデルを更新したら, 同じ画像で分布を見直す.
- `tests/data/yolo_reference.txt` (検出器のテストの基準) は, しきい値 0.5 で作ったままだった. 2026-11-23 にテストを全体テストだけにしたとき, 検出器のテストと一緒に消した.
