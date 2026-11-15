# 文書の地図

人の索引と, AI が作業の前に読む文書を決めるための地図を兼ねる.
ルートの CLAUDE.md がこの文書を読み込み, この文書が下の分野ごとの地図を読み込む.

## 使い方

1. 頼まれた作業がどの分野かを, 下の「分野」の表で決める. 複数の分野にまたがるなら, 当てはまる分野すべての地図を使う.
2. その分野の地図の「作業の前に必ず読む」と「作業の前に読む」を, 作業を始める前に Read で読む. 読み終えるまでコードを書かない.
3. 「要るときに読む」は, その話題に触れたときに読む.

すべての作業で守るルール (返答の言語, コミット, コードの書き方, 作業記録) は CLAUDE.md が読み込み済みなので, 読み直さなくてよい.

## 文書の置き方

- **ルール** (`development/`): 作業のときに守るもの.
- **資料** (`environment/`, `logic/`, `web/`, `android/`): 仕様, 手順, 記録. 作業の文脈として読むもの.
- 分野の地図は, その分野の資料のディレクトリの `README.md` に置く. 文書を足したら, その分野の地図に足す.
- 地図から `@` で読み込むのは, 下の階層の地図だけにする. ルールや資料の本文はリンクで示し, 作業のときに開く.
  本文まで読み込むと, 関係のない作業でもすべてが毎回読み込まれ, 大事な指示が埋もれるため.

## 分野

| 分野 | 頼まれる作業の例 | 地図 |
|---|---|---|
| ロジック, CLI | `core/`, `cli/`, `tests/` の C++. チップの検出, 色の判定, CLI, テスト | [logic/README.md](logic/README.md) |
| Android | `android/` の Kotlin と JNI の C++. 撮影, 検出画面, WebView | [android/README.md](android/README.md) |
| Web | `web/` の点数計算アプリ (画面, API, DB) | [web/README.md](web/README.md) |
| 研究開発 | `research/` での色別計数の試作, 実験 | 下の「研究開発」 |
| 環境 | ツールの導入, ビルドの設定, マシンの移行 | 下の「環境」 |

## 全体

| 文書 | いつ読むか | 中身 |
|---|---|---|
| [architecture.md](architecture.md) | 構成や分野の関係を知りたいとき. 構成を変えるとき | 全体の設計 (C++ のロジック, Android, Web) と, そう決めた理由 |
| [worklog.md](worklog.md) | 環境やファイル構造を変えたとき (記録を足す) | 作業記録 |
| [development/commit.md](development/commit.md) | (CLAUDE.md が読み込み済み) | コミットの決まり |
| [development/code-rules.md](development/code-rules.md) | (CLAUDE.md が読み込み済み) | 言語によらないコードの書き方 |

## 研究開発

- 作業の前に必ず読む: [development/research.md](development/research.md) 研究開発の方針 (既存のコードを変えない, 評価の仕方)
- 作業の前に読む: `research/` の中の過去の研究の README.md (何を試し, 何が効かなかったか)
- 要るときに読む: [logic/usage.md](logic/usage.md) CLI とテストの動かし方, [logic/labeling.md](logic/labeling.md) ラベル付けの手順

## 環境

- 作業の前に読む: [environment/setup.md](environment/setup.md) セットアップの手順
- 要るときに読む: [environment/migration.md](environment/migration.md) 別のマシンへの移行, [worklog.md](worklog.md) これまでの環境の変更

## 分野ごとの地図

@logic/README.md

@android/README.md

@web/README.md
