# pokerchip

ポーカーチップのスタックの写真から, チップの枚数と色を求める. Linux で実験し, 同じ C++ のロジックを Android アプリで動かす.

- 設計: [docs/architecture.md](docs/architecture.md)
- Linux での使い方 (ビルド, CLI, テスト): [docs/usage.md](docs/usage.md)
- 点数計算アプリ (Web, バックエンド): [docs/web/app.md](docs/web/app.md), 点数計算のルール: [docs/web/scoring.md](docs/web/scoring.md)
- 点数計算アプリの起動: [docs/web/running.md](docs/web/running.md)

## 返答の言語

人への返答は, すべて日本語で書く. 作業の途中に出す短い進み具合の報告や, 最後のまとめも日本語にする.
コード, コマンド, ファイル名, ライブラリ名などの固有の名前は, 元の表記のままでよい.

## コーディング規約

C++ のコードを書く・直すときは次の規約に従う.

@docs/coding-style.md

## 作業記録 (docs/worklog.md)

docs/worklog.md には環境に関する変更だけを記録する.

- 記録する: 環境構築 (ツールやライブラリの導入・更新, 手順の変更), アーキテクチャ, ファイル構造 (ディレクトリやファイルの追加・移動・削除), ビルドの設定.
- 記録しない: ロジック, アルゴリズム, パラメータの変更, バグの修正, リファクタ. これらはコミットメッセージに書く.

## 研究開発

チップの計数の研究開発 (試作) をするときは, 次の方針に従う.

- 目的は 2 つある. 色別計数 (色と枚数が両方合う) を正確に行うことと, それを目指す中で知見を得ること.
  正答率が上がらなくても, なぜ誤るか, 何が効かないかが分かれば成果として残す.
- 研究者として自由に探索してよい. 好奇心に従って目標からそれてもよい.
- 試行錯誤のためにロジックやアルゴリズムを変えるのは自由. ただし既存のコード (`core/`, `cli/`, `android/` など) は変えない.
  変えたいときは `research/` に写すか, 別のスクリプトを書いて試す. 言語や道具 (Python, C++ など) も自由に選んでよい.
- 試作は `research/YYYY-MM-DD-<内容>/` に置く. `research/` は `.gitignore` で除外していて, git の履歴に残さない.
  中の README.md に, 流し方, 結果, 分かったこと, 効かなかったこと, 次の一手を書く.
- 評価はスタック単位 (1 スタック抜き) で行う. 画像単位で分けると同じスタックが学習とテストにまたがり, 甘くなるため.
- 「N 分続けて」と言われたら, その時間いっぱい研究を続けてから報告する.

## Web アプリの開発

`web/` の作業をするときは, 次の流れ, コードの書き方, セキュリティの規則, TypeScript の書き方に従う.

@docs/web/development.md

@docs/web/code-rules.md

@docs/web/security.md

@docs/web/typescript.md

## Android アプリの Kotlin

`android/` の Kotlin を書く・直すときは, 上のコードの書き方 (code-rules.md) と次の Kotlin の書き方に従う.

@docs/web/kotlin.md
