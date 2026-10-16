ALTER TABLE contacts ADD COLUMN IF NOT EXISTS created_at BIGINT NOT NULL DEFAULT 0;

-- Contacts created in this app have random hex ids and their last update is the best
-- estimate of their creation. Imported contacts (purely numeric ids) have no known
-- creation time, so they stay at 0 and sort as the oldest.
UPDATE contacts SET created_at = updated_at WHERE created_at = 0 AND contact_id !~ '^cnt_[0-9]+$';
