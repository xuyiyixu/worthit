ALTER TABLE decision_threads
  ADD COLUMN IF NOT EXISTS marked_skip_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS decision_feedback (
  id UUID PRIMARY KEY,
  thread_id UUID NOT NULL UNIQUE REFERENCES decision_threads(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('went', 'skipped')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
  costs JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS decision_feedback_thread_idx ON decision_feedback(thread_id);
