# 画像のラベル付け (labelme)

`testimages/v2/single_color/` の画像に, スタックの側面を囲む bounding box を付ける手順をまとめる. 道具は [labelme](https://github.com/wkentaro/labelme) を使う.

確かめた環境: WSL2 (WSLg), Python 3.12, labelme 7.9.1.

## 環境を作る

リポジトリの根に labelme 専用の仮想環境 `.venv-label` を作る. git では管理しない.

`.venv` には入れない. labelme を入れると, `pyscript/requirements.txt` で固定している `onnxruntime` のバージョンが下がるため.

```sh
python3 -m venv .venv-label
.venv-label/bin/pip install labelme==7.9.1
```

`.venv-label` は約 1.2GB になる.

## 起動する

リポジトリの根で次を実行する. labelme を閉じるまで, ターミナルは戻らない.

```sh
.venv-label/bin/labelme testimages/v2/single_color \
  --output testimages/v2/single_color/labels \
  --labels stack_side \
  --flags confirmed,unconfirmed \
  --validate-label exact \
  --no-sort-labels
```

**`--output` は必ず付ける.** 付けないと, 自動保存で画像の隣 (`testimages/v2/single_color/`) に JSON ができる. `labels/` がなくても, 最初の保存のときに作られる.

`QT_QPA_PLATFORM=xcb` は付けない. `libxcb-cursor0` がないと異常終了する. 指定しなければ WSLg の Wayland で動く.

## 付けるラベル

座標は元画像の画素で保存される. 1 枚につき, ラベル `stack_side` の箱を種類 `Rectangle` で 1 つ付ける.
箱はスタックの側面だけを囲み, 上の面を入れない.

| 箱の辺 | 位置 |
|---|---|
| 上 | 中央付近で, 一番上のチップの上の面と側面が折れ曲がる線 |
| 下 | 一番下のチップのいちばん下 |
| 左, 右 | 上の辺より下に写っているチップの左端, 右端 |

上の辺は, 色の模様が始まる位置ではない. 模様は上の面まで回り込んでいるので, 見下ろす角度が大きいほど, 模様の始まりより下になる.
上の辺より上にあるチップのはみ出しは, 左右の範囲に入れない.

画像ごとのフラグは, 右上の `Flags` の欄で付ける.

| フラグ | 意味 |
|---|---|
| `confirmed` | 人が確かめた |
| `unconfirmed` | まだ人が確かめていない |

## 操作
人間用説明書。操作方法が分からないときに参考にする。

変更は自動で保存される. 右下の表示が `Saved` になれば保存済み.

| 操作 | やり方 |
|---|---|
| 箱を新しく付ける | 左の `Rectangle` (`Ctrl+R`) を選び, 対角の 2 点をクリックしてラベルを選ぶ |
| 箱の大きさを変える | 編集モード (`Ctrl+J`) で箱の角をドラッグする |
| 箱を動かす | 編集モードで箱の内側をドラッグする |
| 箱を少しずつ動かす | 編集モードで箱を選び, 矢印キーを押す |
| 箱を消す | 箱を選び, `Delete` を押す |
| 取り消す | `Ctrl+Z` |
| 前後の画像へ移る | `A` (前), `D` (次) |
| 拡大, 縮小 | `Ctrl` + ホイール |
| 画面に合わせる | `Ctrl+F` |
| 上下, 左右に動かす | ホイール, `Shift` + ホイール |
| 箱をすべて隠す, 出す | `T` |

`AI-Points`, `AI-Box`, `AI Assist`, `AI Text Prompt` は使わない.

## ラベルの置き場所と流れ

ラベルは `testimages/v2/single_color/labels/` に, 画像ごとに 1 つの JSON (labelme の形式) で置く. 画像は git で管理しないが, ラベルは管理する.

```
testimages/v2/single_color/
  PXL_....jpg            # git で管理しない
  answers.jsonl
  labels/PXL_....json    # git で管理する
```

流れは次のとおり.

1. 人または AI が箱を付ける. AI が付けたものにはフラグ `unconfirmed` を付ける.
2. 人が確かめて直し, 問題がなければ `unconfirmed` を外して `confirmed` を付ける.
3. `confirmed` の付いたファイルだけをコミットする.

AI が付けた箱は, 箱の `description` に `ai:` で始まる印がある. 未確定のファイルも同じ場所に並ぶ. コミットの前に, `confirmed` の付いていないファイルを次で確かめる.

```sh
python3 -c "import glob,json; [print(p) for p in sorted(glob.glob('testimages/v2/single_color/labels/*.json')) if not json.load(open(p))['flags'].get('confirmed')]"
```
