-- マッチの色ごとの点数 (チップ 1 枚の点数). 行のない色は, そのマッチで使わない色.
-- 持ち点への換算は画面で行い, ここは保存して返すだけ (docs/web/app.md).
-- この表より前に作ったマッチには行がない. リーダーがあとから決められる.

CREATE TABLE match_chip_values (
  match_id TEXT NOT NULL REFERENCES matches (id),
  -- core の chipColorName が返す 7 色. 色を足すのは core の基準色を作り直すときだけ.
  color TEXT NOT NULL CHECK (
    color IN (
      'red',
      'blue',
      'yellow',
      'black',
      'gray',
      'purple',
      'green'
    )
  ),
  points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 1000000000),
  PRIMARY KEY (match_id, color)
);
