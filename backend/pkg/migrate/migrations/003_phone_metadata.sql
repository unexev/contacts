ALTER TABLE contact_phones ADD COLUMN IF NOT EXISTS created_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE contact_phones ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE contact_phones SET created_at = updated_at WHERE created_at = 0 AND updated_at <> 0;
