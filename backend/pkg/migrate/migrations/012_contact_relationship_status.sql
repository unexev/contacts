-- Real-life situation, independent of the legal marital status (status_id). NULL = unknown.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS relationship_status TEXT
    CHECK (relationship_status IN ('SINGLE', 'PARTNERED', 'COHABITING'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS children_count INTEGER
    CHECK (children_count >= 0);
