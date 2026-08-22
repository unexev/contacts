-- Contact locations. Values in location_type are stable English identifiers.
CREATE TABLE IF NOT EXISTS contact_locations (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    location_type TEXT NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    postal_code TEXT NOT NULL DEFAULT '',
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_location_user ON contact_locations(user_id);
