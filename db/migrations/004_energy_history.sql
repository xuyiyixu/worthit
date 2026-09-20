CREATE TABLE IF NOT EXISTS user_checkins (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  social INTEGER NOT NULL CHECK (social BETWEEN 0 AND 100),
  physical INTEGER NOT NULL CHECK (physical BETWEEN 0 AND 100),
  mood TEXT NOT NULL,
  stress INTEGER NOT NULL CHECK (stress BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_checkins_user_created_idx
  ON user_checkins(user_id, created_at DESC);

ALTER TABLE decision_threads
  ADD COLUMN IF NOT EXISTS energy_before INTEGER CHECK (energy_before BETWEEN 0 AND 100);

ALTER TABLE decision_threads
  ADD COLUMN IF NOT EXISTS context_group TEXT CHECK (context_group IN ('small', 'large', 'solo'));

ALTER TABLE decision_threads
  ADD COLUMN IF NOT EXISTS context_people TEXT CHECK (context_people IN ('friends', 'strangers', 'alone'));

ALTER TABLE decision_feedback
  ADD COLUMN IF NOT EXISTS energy_after INTEGER CHECK (energy_after BETWEEN 0 AND 100);
