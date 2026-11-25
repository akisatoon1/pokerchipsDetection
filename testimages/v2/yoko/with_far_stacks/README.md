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

形式は [docs/development/testimages.md](../../../../docs/development/testimages.md) の「正解の形式」にある (v2 のすべてのデータセットで同じ).
手前の, 数えたいスタックだけを `stacks` に入れる. 奥に写ったスタックは入れない.
1 枚に数えたいスタックが 2 つある画像では, `stacks` の要素は 2 つになる.
