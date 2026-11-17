-- Auth hardening: shared rate-limit counters and case-insensitive emails.

-- 1. Fixed-window counters. They live in Postgres because the in-memory
--    limiter was per serverless instance, so it limited almost nothing.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key          TEXT PRIMARY KEY,
    window_start BIGINT NOT NULL,
    count        INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_start);

-- 2. Emails are matched case-insensitively. The unique index is skipped while
--    legacy rows still collide by case, so this migration can never fail.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM app_users GROUP BY lower(email) HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower ON app_users (lower(email));
    END IF;
END $$;
