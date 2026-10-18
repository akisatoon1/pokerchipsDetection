-- マッチとプレイヤー. id は推測できない乱数 (docs/web/security.md).

CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initial_points INTEGER NOT NULL,
  -- players と互いに参照するため, 外部キーの制約は付けない. 作るときに同じトランザクションで入れる.
  leader_player_id TEXT NOT NULL
);

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches (id),
  name TEXT NOT NULL,
  -- トークンそのものではなく SHA-256 を保存する. DB が漏れてもなりすましに使えないようにするため.
  token_hash TEXT NOT NULL UNIQUE,
  -- 参加した順 (1 から). 結果の表をこの順に並べる.
  position INTEGER NOT NULL,
  -- 結果の表で誰が誰か分からなくならないよう, 同じマッチで名前は重ねない.
  UNIQUE (match_id, name),
  UNIQUE (match_id, position)
);
