# データセットの内容

## 目的
カジノチップの色別計数

## 条件
- 綺麗に揃ったスタックのみ
- スタックは画像内に1つのみ
- 色は7種類
- スタックは単色
- 撮る角度は決めていない. 横から, 斜め上から, 上からなどが混ざる
- スタックの枚数は5枚 ~ 26枚
- スタック枚数が5枚の場合は7色の全てがある。6枚 ~ 26枚の場合はどれか1つの色のみ。

## 構成

構成の決まりは [docs/development/testimages.md](../../../docs/development/testimages.md) にある.

```
README.md        # この文書
answers.jsonl    # 正解
images/          # 画像
labels/          # スタックの側面の箱 (labelme の JSON). 付け方は docs/logic/labeling.md
```

## 正解 (answers.jsonl)

形式は [docs/development/testimages.md](../../../docs/development/testimages.md) の「正解の形式」にある (v2 のすべてのデータセットで同じ).
画像にスタックは 1 つなので, `stacks` の要素は 1 つ.
