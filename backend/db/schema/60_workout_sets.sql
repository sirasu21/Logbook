-- 既存テーブルを書き換える場合は、CREATE TABLE 部分を修正
-- もう適用済みなら ALTER TABLE でOK（後述）

CREATE TABLE workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  set_index SMALLINT NOT NULL CHECK (set_index >= 1),
  -- 筋トレ用
  reps SMALLINT CHECK (reps >= 1 AND reps <= 1000),
  weight_kg NUMERIC(6,2) CHECK (weight_kg >= 0),
  rpe NUMERIC(3,1) CHECK (rpe IS NULL OR (rpe >= 0 AND rpe <= 10)),
  is_warmup BOOLEAN NOT NULL DEFAULT false,
  rest_sec INTEGER CHECK (rest_sec IS NULL OR rest_sec BETWEEN 0 AND 7200),
  note TEXT,
  -- 有酸素用（どちらか/両方でもOK）
  duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec BETWEEN 0 AND 21600),
  distance_m NUMERIC(8,2) CHECK (distance_m IS NULL OR (distance_m >= 0 AND distance_m <= 100000)),
  -- 最低限、何も入ってないレコードを防ぐ
  CONSTRAINT workout_sets_presence CHECK (
    (reps IS NOT NULL OR weight_kg IS NOT NULL)
    OR (duration_sec IS NOT NULL OR distance_m IS NOT NULL)
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX workout_sets_unique_order
  ON workout_sets (workout_id, set_index);

CREATE INDEX workout_sets_idx_workout
  ON workout_sets (workout_id, set_index);

CREATE INDEX workout_sets_idx_exercise
  ON workout_sets (exercise_id, created_at);