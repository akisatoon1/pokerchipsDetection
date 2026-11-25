# データセットの内容

## 目的
遠くに写ったスタックを, 数える対象から外せるかを確かめる (issue #3).
手前にある, 数えたいスタックだけを正解とし, 奥に写ったスタックは正解に入れない.

## 条件
- 真横から撮る
- 手前に, 数えたいスタックが 1 つか 2 つある. 横に並べて置く
- 奥 (テーブルの遠くの側) に, 数えないスタックがいくつか写っている
- 手前のスタックは複数色. 枚数は 21 枚か 23 枚
- Android の端末 (Pixel 8a) で, 検証用のアプリ (`android/`) から撮った. ファイル名はアプリが付けたまま

## 構成

構成の決まりは [docs/development/testimages.md](../../../../docs/development/testimages.md) にある.

```
README.md        # この文書
answers.jsonl    # 正解
images/          # 画像
```

## 正解 (answers.jsonl)

画像ごとの正解を `answers.jsonl` に書く.
Hugging Face の `imagefolder` の metadata と同じ形式で, 1 行に 1 枚分の JSON を書く. 次は形式の例 (`colors` は略してある).

```jsonl
{"file_name": "images/pokerchip_1795604841325.jpg", "stacks": [{"colors": ["black", "green", ...]}, {"colors": ["purple", "purple", ...]}], "labeled_by": "ai"}
```

| 項目 | 内容 |
|---|---|
| `file_name` | 画像のパス. `answers.jsonl` から見た相対パス (`images/<ファイル名>`) |
| `stacks` | 手前の, 数えたいスタック. 画像の左から順に並べる. 奥のスタックは入れない |
| `stacks[].colors` | チップの色. 上のチップから順に書く. 名前は CLI の `--json` (`toJson`) と同じ (`red` `blue` `yellow` `black` `gray` `purple` `green`) |
| `labeled_by` | 正解を付けたもの. `human` は人, `ai` は生成 AI |

[../single_color/README.md](../single_color/README.md) の形式 (画像の直下に `colors`) と違い, スタックを配列にしている.
1 枚に数えたいスタックが 2 つある画像があるため.
スタックの並びを左からにするのは, CLI の `--json` の `stacks` と, 箱の x 座標で並べ替えて突き合わせられるようにするため.
画像の向きは EXIF の向きを当てたあと (人が見る向き) で考える.

枚数の項目を置かない理由は single_color と同じ (`colors` の要素の数で決まる).
