-- Country for identity documents, so validation rules can be scoped per country.
ALTER TABLE identity_cards ADD COLUMN IF NOT EXISTS country_code TEXT;
