# データセットの内容

## 目的
カジノチップの色別計数

## 条件
- 綺麗に揃ったスタックのみ
- スタックは画像内に1つのみ
- 色は7種類
- スタックは単色
- スタックの枚数は5枚 ~ 26枚
- スタック枚数が5枚の場合は7色の全てがある。6枚 ~ 26枚の場合はどれか1つの色のみ。

## 正解 (answers.jsonl)

画像ごとの正解を `answers.jsonl` に書いている.
Hugging Face の `imagefolder` の metadata と同じ形式で, 1 行に 1 枚分の JSON を書く.

```jsonl
{"file_name": "PXL_20261028_124800145.jpg", "count": 5, "colors": ["gray", "gray", "gray", "gray", "gray"], "labeled_by": "human"}
```

| 項目 | 内容 |
|---|---|
| `file_name` | 画像のファイル名 |
| `count` | スタックの枚数 |
| `colors` | チップの色. 上のチップから順に書く. 名前は CLI の `--json` (`toJson`) と同じ (`red` `blue` `yellow` `black` `gray` `purple` `green`) |
| `labeled_by` | 正解を付けたもの. `human` は人, `ai` は生成 AI |

`colors` の要素の数は `count` と同じになる.
複数色のスタックも同じ形式で書けるように, 単色でも色を枚数ぶん並べている.
