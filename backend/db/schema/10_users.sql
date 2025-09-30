CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL CHECK (char_length(display_name) <= 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);