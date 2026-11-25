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

形式は [docs/development/testimages.md](../../../../docs/development/testimages.md) の「正解の形式」にある (v2 のすべてのデータセットで同じ).
画像にスタックは 1 つなので, `stacks` の要素は 1 つ.
