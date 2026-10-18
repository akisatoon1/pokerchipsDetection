-- プレイヤーがラウンドに入れた持ち点. 増減と累計は保存せず, 読むたびに計算する.

CREATE TABLE entries (
  round_id TEXT NOT NULL REFERENCES rounds (id),
  player_id TEXT NOT NULL REFERENCES players (id),
  points INTEGER NOT NULL,
  PRIMARY KEY (round_id, player_id)
);
