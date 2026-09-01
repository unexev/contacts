CREATE TABLE IF NOT EXISTS contact_nationalities (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    nationality_id TEXT NOT NULL,
    country_code TEXT NOT NULL,
    acquired_at TEXT,
    note TEXT,
    PRIMARY KEY (user_id, contact_id, nationality_id)
);
CREATE INDEX IF NOT EXISTS idx_nationality_user ON contact_nationalities(user_id);
CREATE INDEX IF NOT EXISTS idx_nationality_contact ON contact_nationalities(user_id, contact_id);
