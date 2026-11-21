-- Sign in with Google: the Google account id (the token's "sub") is stored on
-- the user. Accounts created through Google have no password (empty hash).
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS google_sub TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_google_sub
    ON app_users(google_sub) WHERE google_sub IS NOT NULL;
