# テスト画像の置き方 (testimages/)

`testimages/` にテスト画像のデータセットを足す・動かすときに守る決まりをまとめる.
ラベル (箱) の付け方は [../logic/labeling.md](../logic/labeling.md) にある.

## 構成

データセットは `testimages/<版>/<データセットの名前>/` に 1 つずつ置き, 中を次の形にする.

```
testimages/v2/single_color/
  README.md        # 目的, 撮影の条件, 正解の形式
  answers.jsonl    # 正解. 1 行に 1 枚分
  images/          # 画像だけを置く
  labels/          # 箱のラベル. 箱を付けるデータセットだけに置く
```

| 置くもの | 決まり |
|---|---|
| `README.md` | データセットの目的, 撮影の条件 (スタックの数, 色の数, 枚数の範囲など), `answers.jsonl` の項目を書く |
| `answers.jsonl` | 1 行に 1 枚分の JSON を書く. `file_name` は `answers.jsonl` から見た画像の相対パス (`images/<ファイル名>`) にする. ほかの項目はデータセットの README に書く |
| `images/` | 画像だけを置く. ファイル名は撮ったときのままにする |
| `labels/` | 画像ごとに 1 つの labelme の JSON を, 画像と同じ名前 (拡張子だけ `.json`) で置く. `imagePath` は `../images/<ファイル名>` になる |

### そう決めた理由

- **画像を `images/` に分ける**: 最上位に画像と README, 正解, ラベルが混ざらず, 画像だけを列挙できるため.
- **正解を 1 ファイルにまとめる**: 正解は付けたら直さず, 評価でまとめて読む使い方が主なため.
  1 ファイルなら, 開くだけで全体を見渡せ, 集計もすぐできる.
- **`file_name` を `images/` 付きのパスにする**: Hugging Face の `imagefolder` の metadata と同じ形にするため.
  値だけで画像の場所が分かる.

## 画像を足すとき

- 写真の位置情報 (GPS) と, 写った個人が分かるものを, コミットの前に確かめる ([security.md](security.md)).
- 足した画像の正解を `answers.jsonl` に書く.

## この形に合わない既存のデータセット

次のデータセットは古い形のまま置いている. テスト (`tests/test_color.cpp`) や補助のスクリプト (`pyscript/`) が,
いまのパスと `answers.txt` の形式を前提にしているため. 新しいデータセットには使わない.

| 場所 | 古い形 |
|---|---|
| `testimages/v1/` | 画像を正解と同じ階層に置く. 正解は `answers.txt` (`<ファイル名> <枚数> <色...>` を 1 行に 1 スタック). 正解のないディレクトリもある |
| `testimages/train/` | `v1/` と同じ |
