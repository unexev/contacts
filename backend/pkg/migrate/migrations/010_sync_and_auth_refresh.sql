-- Contacts SaaS — Migración 010: Sync y Refresh Tokens
-- Añade soft-delete y updated_at donde falte, más tablas para sincronización y refresh tokens.

-- 1. Contact Nationalities (006_nationalities.sql no tenía updated_at ni deleted)
ALTER TABLE contact_nationalities ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
ALTER TABLE contact_nationalities ADD COLUMN IF NOT EXISTS deleted INT DEFAULT 0;

-- 2. Organizations (Catálogo por usuario tras 008)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at BIGINT DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted INT DEFAULT 0;

-- 3. Índices compuestos (user_id, updated_at) para acelerar pull de sync delta en todas las tablas sincronizables
CREATE INDEX IF NOT EXISTS idx_contacts_user_updated ON contacts(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_phones_user_updated ON contact_phones(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_emails_user_updated ON contact_emails(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_urls_user_updated ON contact_urls(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_notes_user_updated ON contact_notes(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_keywords_user_updated ON contact_keywords(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_identity_cards_user_updated ON identity_cards(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_bank_user_updated ON contact_bank_accounts(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_rel_user_updated ON contact_relationships(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_org_user_updated ON contact_organizations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_loc_user_updated ON contact_locations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_contact_nat_user_updated ON contact_nationalities(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_organizations_user_updated ON organizations(user_id, updated_at);

-- 4. Opaque rotating refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES app_users(user_id),
    family_id  TEXT NOT NULL,
    created_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    revoked_at BIGINT,
    rotated_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family ON refresh_tokens(family_id);

-- 5. Idempotency keys para sync push
CREATE TABLE IF NOT EXISTS sync_changes (
    user_id    TEXT NOT NULL REFERENCES app_users(user_id),
    change_id  TEXT NOT NULL,
    applied_at BIGINT NOT NULL,
    PRIMARY KEY (user_id, change_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_applied ON sync_changes(applied_at);
