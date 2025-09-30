CREATE TABLE body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg BETWEEN 20 AND 300),
  body_fat_pct NUMERIC(4,1) CHECK (body_fat_pct BETWEEN 0 AND 100),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX body_metrics_idx_user
  ON body_metrics (user_id, measured_at DESC);