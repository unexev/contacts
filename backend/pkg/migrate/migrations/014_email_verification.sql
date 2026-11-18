-- Email verification: a flag on the user and single-use tokens.

-- Accounts that already exist count as verified; only new ones start false.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_name = 'app_users' AND column_name = 'email_verified'
    ) THEN
        ALTER TABLE app_users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
        UPDATE app_users SET email_verified = TRUE;
    END IF;
END $$;

-- The token is stored hashed. It also records the address it was sent to, so
-- a token for an old address cannot verify a changed email.
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
