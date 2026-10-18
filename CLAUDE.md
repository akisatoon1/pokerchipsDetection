# pokerchip

ポーカーチップのスタックの写真から, チップの枚数と色を求める. Linux で実験し, 同じ C++ のロジックを Android アプリで動かす.

- 設計: [docs/architecture.md](docs/architecture.md)
- Linux での使い方 (ビルド, CLI, テスト): [docs/usage.md](docs/usage.md)
- 点数計算 (マッチとラウンド): [docs/scoring.md](docs/scoring.md)
- 点数計算アプリ (Web, バックエンド): [docs/web-app.md](docs/web-app.md)

## コーディング規約

C++ のコードを書く・直すときは次の規約に従う.

@docs/coding-style.md

## 作業記録 (docs/worklog.md)

docs/worklog.md には環境に関する変更だけを記録する.

- 記録する: 環境構築 (ツールやライブラリの導入・更新, 手順の変更), アーキテクチャ, ファイル構造 (ディレクトリやファイルの追加・移動・削除), ビルドの設定.
- 記録しない: ロジック, アルゴリズム, パラメータの変更, バグの修正, リファクタ. これらはコミットメッセージに書く.

## Web アプリの開発

`web/`, `server/` の作業をするときは, 次の流れに従う.

@docs/web-development.md
