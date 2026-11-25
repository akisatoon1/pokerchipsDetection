# 地図: ロジック, CLI (`core/`, `cli/`, `functional_tests/`, `wasm/`)

チップの計数のロジック (C++) と, それを Linux で動かす CLI, ブラウザで動かす WASM の殻, テストの作業で読む.

## 作業の前に必ず読む (ルール)

- [../development/cpp-coding-style.md](../development/cpp-coding-style.md) C++ のコーディング規約 (Doxygen コメント, 整形と検査)

## 作業の前に読む (文脈)

- [../architecture.md](../architecture.md) 処理の流れ (検出, 色の判定) と設計判断の理由. WASM の殻は「10. Web でも core を WASM にして動かす」
- [usage.md](usage.md) ロジックの作業で使う make のコマンド. ビルド, CLI の実行, テスト, 検査, WASM のビルドと CLI との比べ

## 要るときに読む

- [labeling.md](labeling.md) テスト画像のラベル付けの手順
- [adr.md](adr.md) パラメータや方式をデータを見て決めた記録 (検出のしきい値, 奥のスタックを除く幅の比など). 根拠のデータは [data/](data/) にある
- [../environment/setup.md](../environment/setup.md) セットアップ (マシンに入れるものと, clone したあとの `make setup`)
