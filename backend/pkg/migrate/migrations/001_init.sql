-- Contacts SaaS — Migración inicial
-- Adaptado de contacts-app-offline SQLite schema a PostgreSQL

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT DEFAULT '',
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at BIGINT DEFAULT 0
);

-- Estado civil (catálogo)
CREATE TABLE IF NOT EXISTS marital_status (
    status_id TEXT PRIMARY KEY,
    marital_status TEXT NOT NULL
);

-- Tipo de relación (catálogo)
CREATE TABLE IF NOT EXISTS relationship_types (
    type_id TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

-- Organización (catálogo)
CREATE TABLE IF NOT EXISTS organizations (
    organization_id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Contacto principal
CREATE TABLE IF NOT EXISTS contacts (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    middle_name TEXT,
    surname TEXT NOT NULL,
    birthdate TEXT,
    gender TEXT,
    status_id TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id)
);

-- Teléfonos
CREATE TABLE IF NOT EXISTS contact_phones (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    phone_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    label TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, phone_id)
);

-- Emails
CREATE TABLE IF NOT EXISTS contact_emails (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    email_id TEXT NOT NULL,
    email TEXT NOT NULL,
    label TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, email_id)
);

-- URLs
CREATE TABLE IF NOT EXISTS contact_urls (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    url_id TEXT NOT NULL,
    url TEXT NOT NULL,
    label TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, url_id)
);

-- Notas
CREATE TABLE IF NOT EXISTS contact_notes (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    note_id TEXT NOT NULL,
    note TEXT NOT NULL,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, note_id)
);

-- Palabras clave / etiquetas
CREATE TABLE IF NOT EXISTS contact_keywords (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, keyword)
);

-- Documentos de identidad
CREATE TABLE IF NOT EXISTS identity_cards (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    card_id TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    card_number TEXT NOT NULL,
    issue_date TEXT,
    expiry_date TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, card_id)
);

-- Cuentas bancarias
CREATE TABLE IF NOT EXISTS contact_bank_accounts (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    bank_account_id TEXT NOT NULL,
    bank_name TEXT,
    account_number TEXT NOT NULL,
    account_type TEXT,
    label TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, bank_account_id)
);

-- Relaciones entre contactos
CREATE TABLE IF NOT EXISTS contact_relationships (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    related_contact_id TEXT NOT NULL,
    type_id TEXT NOT NULL,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, related_contact_id, type_id),
    FOREIGN KEY (type_id) REFERENCES relationship_types(type_id)
);

-- Organizaciones de contacto
CREATE TABLE IF NOT EXISTS contact_organizations (
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    achievement TEXT,
    date TEXT,
    updated_at BIGINT DEFAULT 0,
    deleted INT DEFAULT 0,
    PRIMARY KEY (user_id, contact_id, organization_id),
    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_contact_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_phone_user ON contact_phones(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_email_user ON contact_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_note_user ON contact_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_url_user ON contact_urls(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_keyword_user ON contact_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_card_user ON identity_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_bank_user ON contact_bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_relationship_user ON contact_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_org_user ON contact_organizations(user_id);

-- Datos iniciales
INSERT INTO marital_status (status_id, marital_status) VALUES
    ('soltero', 'Soltero/a'), ('casado', 'Casado/a'), ('divorciado', 'Divorciado/a'),
    ('viudo', 'Viudo/a'), ('union_libre', 'Unión libre'), ('separado', 'Separado/a')
ON CONFLICT (status_id) DO NOTHING;

INSERT INTO relationship_types (type_id, label) VALUES
    ('padre','Padre'),('madre','Madre'),('hijo','Hijo'),('hija','Hija'),
    ('hermano','Hermano'),('hermana','Hermana'),('tio','Tío'),('tia','Tía'),
    ('sobrino','Sobrino'),('sobrina','Sobrina'),('abuelo','Abuelo'),('abuela','Abuela'),
    ('primo','Primo'),('prima','Prima'),('conyuge','Cónyuge'),('nieto','Nieto'),('nieta','Nieta')
ON CONFLICT (type_id) DO NOTHING;
