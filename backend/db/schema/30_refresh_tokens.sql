CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti TEXT NOT NULL UNIQUE,  -- JWT ID
  family_id UUID NOT NULL,   -- ローテーション管理
  token_hash TEXT NOT NULL,  -- ハッシュ化したRefresh Token
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  rotated_from_jti TEXT,     -- 二重使用検知
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);