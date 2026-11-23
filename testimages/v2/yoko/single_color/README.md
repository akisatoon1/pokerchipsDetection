# データセットの内容

## 目的
カジノチップの色別計数

## 条件
- 真横から撮る
- スタックは画像内に1つのみ
- スタックは単色
- スタックの枚数は5枚 ~ 25枚

## 構成

構成の決まりは [docs/development/testimages.md](../../../../docs/development/testimages.md) にある.

```
README.md        # この文書
answers.jsonl    # 正解
images/          # 画像
```

## 正解 (answers.jsonl)

画像ごとの正解を `answers.jsonl` に書く.
Hugging Face の `imagefolder` の metadata と同じ形式で, 1 行に 1 枚分の JSON を書く. 次は形式の例.

```jsonl
{"file_name": "images/PXL_20261123_093705462.jpg", "colors": ["black", "black", "black", "black", "black"], "labeled_by": "human"}
```

| 項目 | 内容 |
|---|---|
| `file_name` | 画像のパス. `answers.jsonl` から見た相対パス (`images/<ファイル名>`) |
| `colors` | チップの色. 上のチップから順に書く. 名前は CLI の `--json` (`toJson`) と同じ (`red` `blue` `yellow` `black` `gray` `purple` `green`) |
| `labeled_by` | 正解を付けたもの. `human` は人, `ai` は生成 AI |

枚数の項目は置かない. 枚数は `colors` の要素の数で決まり, 別に書くと 2 つが食い違うおそれがあるため.
複数色のスタックも同じ形式で書けるように, 単色でも色を枚数ぶん並べている.
