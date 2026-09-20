CREATE TABLE IF NOT EXISTS tarot_readings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  cards INTEGER[] NOT NULL CHECK (cardinality(cards) = 3),
  energy INTEGER NOT NULL CHECK (energy BETWEEN 0 AND 100),
  reading TEXT NOT NULL,
  guidance TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, reading_date)
);

CREATE INDEX IF NOT EXISTS tarot_readings_user_date_idx
  ON tarot_readings(user_id, reading_date DESC);
