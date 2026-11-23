# テスト画像の置き方 (testimages/)

`testimages/` にテスト画像のデータセットを足す・動かすときに守る決まりをまとめる.
ラベル (箱) の付け方は [../logic/labeling.md](../logic/labeling.md) にある.

## 構成

データセットは `testimages/<版>/<データセットの名前>/` に 1 つずつ置き, 中を次の形にする.

```
testimages/v2/single_color_free_angle/
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

## 画像は Git LFS で管理する

`testimages/` の下の画像 (jpg, jpeg, png, HEIC) は, `v1/` も含めてすべて Git LFS で扱う (`.gitattributes`).
git の履歴には短いポインタだけが入り, 本体は GitHub の LFS の置き場に上がる. ラベルと正解はテキストなので LFS にしない.

- 理由: 画像は数百 MB あり, データセットを足すたびに増える. ふつうの git に入れると, clone するたびに全員が履歴ごと落とし,
  CI (デプロイ) の checkout も毎回すべての画像を落とす. LFS なら CI は画像を落とさず (`actions/checkout` は既定で LFS を取らない),
  手元では画像, 正解, ラベルを同じコミット, 同じパスで扱える.
- GitHub の LFS には保存量と転送量の無料枠がある. 大きなデータセットを足す前に, 枠に収まるかを確かめる.
- ラベルと正解を LFS にしないのは, 小さいうえ, LFS にすると差分を見る, grep で探す, push の前の検査で秘密情報を探す, ができなくなるため.
- 2026-11-23 に過去の履歴も書き換え, それまでにコミットした画像も LFS にした. それより前に clone したものは作り直す
  (古い clone から push すると, 画像の入った古い履歴がまた上がるため).
- 手元の用意 (`git-lfs` を入れる, `git lfs pull`) は [../environment/setup.md](../environment/setup.md) の 2 にある.

## 画像を足すとき

- 拡張子が `.gitattributes` の対象にあるかを確かめる. ない形式 (webp など) を足すなら, 先に `.gitattributes` に足す.
- 写真の位置情報 (GPS) と, 写った個人が分かるものを, コミットの前に確かめる ([security.md](security.md)).
- 足した画像の正解を `answers.jsonl` に書く.

## この形に合わない既存のデータセット

次のデータセットは古い形のまま置いている. 補助のスクリプト (`pyscript/`) が,
いまのパスと `answers.txt` の形式を前提にしているため. 新しいデータセットには使わない.

| 場所 | 古い形 |
|---|---|
| `testimages/v1/` | 画像を正解と同じ階層に置く. 正解は `answers.txt` (`<ファイル名> <枚数> <色...>` を 1 行に 1 スタック). 正解のないディレクトリもある |
| `testimages/train/` | `v1/` と同じ |
