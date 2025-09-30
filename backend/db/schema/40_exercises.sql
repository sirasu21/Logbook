CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id), -- NULLならグローバル
  name TEXT NOT NULL CHECK (char_length(name) <= 64),
  type TEXT NOT NULL, -- 'strength' or 'cardio'
  primary_muscle TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- グローバル種目（owner_user_id IS NULL）のユニーク制約
CREATE UNIQUE INDEX exercises_global_unique_name
  ON exercises (lower(name))
  WHERE owner_user_id IS NULL;

-- ユーザー独自種目のユニーク制約
CREATE UNIQUE INDEX exercises_user_unique_name
  ON exercises (owner_user_id, lower(name));