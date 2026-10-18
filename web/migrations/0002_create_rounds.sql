-- ラウンド. 状態は入力中 (open) か確定 (closed).

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches (id),
  -- マッチの中での番号 (1 から).
  number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  UNIQUE (match_id, number)
);

-- 入力中のラウンドは, マッチごとに常に 1 つだけにする. 同時に始められても 2 つできないようにするため.
CREATE UNIQUE INDEX rounds_one_open_per_match ON rounds (match_id)
WHERE
  status = 'open';
