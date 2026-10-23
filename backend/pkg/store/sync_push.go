package store

import (
	"context"
	"fmt"
	"time"

	"contacts/pkg/model"
)

// Replay checks for contacts and sub-entities
func (s *Store) ContactExists(userID, contactID string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(context.Background(),
		`SELECT EXISTS (SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2 AND deleted = 0)`,
		userID, contactID,
	).Scan(&exists)
	return exists, err
}

// UpsertContact inserts or updates a contact preserving ID and timestamps
func (s *Store) UpsertContact(userID string, c model.Contact) error {
	now := time.Now().UnixMilli()
	if c.UpdatedAt == 0 {
		c.UpdatedAt = now
	}
	if c.CreatedAt == 0 {
		c.CreatedAt = c.UpdatedAt
	}

	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contacts (user_id, contact_id, first_name, middle_name, surname,
		        birthdate, gender, status_id, deceased, updated_at, created_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
		 ON CONFLICT (user_id, contact_id) DO UPDATE
		 SET first_name = EXCLUDED.first_name,
		     middle_name = EXCLUDED.middle_name,
		     surname = EXCLUDED.surname,
		     birthdate = EXCLUDED.birthdate,
		     gender = EXCLUDED.gender,
		     status_id = EXCLUDED.status_id,
		     deceased = EXCLUDED.deceased,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, c.ContactID, c.FirstName, c.MiddleName, c.Surname,
		c.Birthdate, c.Gender, c.StatusID, c.Deceased, c.UpdatedAt, c.CreatedAt,
	)
	return err
}

// UpsertPhone
func (s *Store) UpsertPhone(userID, contactID string, p model.ContactPhone) error {
	now := time.Now().UnixMilli()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	updatedAt := now

	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_phones (user_id, contact_id, phone_id, phone, label, created_at, is_active, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
		 ON CONFLICT (user_id, contact_id, phone_id) DO UPDATE
		 SET phone = EXCLUDED.phone,
		     label = EXCLUDED.label,
		     is_active = EXCLUDED.is_active,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, p.PhoneID, p.Phone, p.Label, p.CreatedAt, p.IsActive, updatedAt,
	)
	return err
}

// UpsertEmail
func (s *Store) UpsertEmail(userID, contactID string, e model.ContactEmail) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_emails (user_id, contact_id, email_id, email, label, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, 0)
		 ON CONFLICT (user_id, contact_id, email_id) DO UPDATE
		 SET email = EXCLUDED.email,
		     label = EXCLUDED.label,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, e.EmailID, e.Email, e.Label, updatedAt,
	)
	return err
}

// UpsertUrl
func (s *Store) UpsertUrl(userID, contactID string, u model.ContactUrl) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_urls (user_id, contact_id, url_id, url, label, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, 0)
		 ON CONFLICT (user_id, contact_id, url_id) DO UPDATE
		 SET url = EXCLUDED.url,
		     label = EXCLUDED.label,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, u.URLID, u.URL, u.Label, updatedAt,
	)
	return err
}

// UpsertNote
func (s *Store) UpsertNote(userID, contactID string, n model.ContactNote) error {
	now := time.Now().UnixMilli()
	if n.UpdatedAt == 0 {
		n.UpdatedAt = now
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_notes (user_id, contact_id, note_id, note, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, 0)
		 ON CONFLICT (user_id, contact_id, note_id) DO UPDATE
		 SET note = EXCLUDED.note,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, n.NoteID, n.Note, n.UpdatedAt,
	)
	return err
}

// UpsertKeyword
func (s *Store) UpsertKeyword(userID, contactID, keyword string) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_keywords (user_id, contact_id, keyword, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, 0)
		 ON CONFLICT (user_id, contact_id, keyword) DO UPDATE
		 SET updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, keyword, updatedAt,
	)
	return err
}

// UpsertCard
func (s *Store) UpsertCard(userID, contactID string, c model.IdentityCard) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO identity_cards (user_id, contact_id, card_id, doc_type, card_number, issue_date, expiry_date, country_code, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
		 ON CONFLICT (user_id, contact_id, card_id) DO UPDATE
		 SET doc_type = EXCLUDED.doc_type,
		     card_number = EXCLUDED.card_number,
		     issue_date = EXCLUDED.issue_date,
		     expiry_date = EXCLUDED.expiry_date,
		     country_code = EXCLUDED.country_code,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, c.CardID, c.DocType, c.CardNumber, c.IssueDate, c.ExpiryDate, c.CountryCode, updatedAt,
	)
	return err
}

// UpsertBankAccount
func (s *Store) UpsertBankAccount(userID, contactID string, b model.ContactBankAccount) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_bank_accounts (user_id, contact_id, bank_account_id, bank_name, account_number, account_type, label, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
		 ON CONFLICT (user_id, contact_id, bank_account_id) DO UPDATE
		 SET bank_name = EXCLUDED.bank_name,
		     account_number = EXCLUDED.account_number,
		     account_type = EXCLUDED.account_type,
		     label = EXCLUDED.label,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, b.BankAccountID, b.BankName, b.AccountNumber, b.AccountType, b.Label, updatedAt,
	)
	return err
}

// UpsertRelationship
func (s *Store) UpsertRelationship(userID, contactID, relatedContactID, typeID string) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_relationships (user_id, contact_id, related_contact_id, type_id, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, 0)
		 ON CONFLICT (user_id, contact_id, related_contact_id, type_id) DO UPDATE
		 SET updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, relatedContactID, typeID, updatedAt,
	)
	return err
}

// UpsertContactOrg
func (s *Store) UpsertContactOrg(userID, contactID string, o model.ContactOrganization) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_organizations (user_id, contact_id, organization_id, achievement, date, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, 0)
		 ON CONFLICT (user_id, contact_id, organization_id) DO UPDATE
		 SET achievement = EXCLUDED.achievement,
		     date = EXCLUDED.date,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, o.OrganizationID, o.Achievement, o.Date, updatedAt,
	)
	return err
}

// UpsertLocation
func (s *Store) UpsertLocation(userID, contactID string, l model.ContactLocation) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_locations (user_id, contact_id, location_id, location_type, address, city, region, country, postal_code, latitude, longitude, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
		 ON CONFLICT (user_id, contact_id, location_id) DO UPDATE
		 SET location_type = EXCLUDED.location_type,
		     address = EXCLUDED.address,
		     city = EXCLUDED.city,
		     region = EXCLUDED.region,
		     country = EXCLUDED.country,
		     postal_code = EXCLUDED.postal_code,
		     latitude = EXCLUDED.latitude,
		     longitude = EXCLUDED.longitude,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, l.LocationID, l.LocationType, l.Address, l.City, l.Region, l.Country, l.PostalCode, l.Latitude, l.Longitude, updatedAt,
	)
	return err
}

// UpsertNationality
func (s *Store) UpsertNationality(userID, contactID string, n model.ContactNationality) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_nationalities (user_id, contact_id, nationality_id, country_code, acquired_at, note, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
		 ON CONFLICT (user_id, contact_id, nationality_id) DO UPDATE
		 SET country_code = EXCLUDED.country_code,
		     acquired_at = EXCLUDED.acquired_at,
		     note = EXCLUDED.note,
		     updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		userID, contactID, n.NationalityID, n.CountryCode, n.AcquiredAt, n.Note, updatedAt,
	)
	return err
}

// UpsertOrganization
func (s *Store) UpsertOrganization(userID, orgID, name string) error {
	updatedAt := time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO organizations (organization_id, user_id, name, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, 0)
		 ON CONFLICT (user_id, name) DO UPDATE
		 SET updated_at = EXCLUDED.updated_at,
		     deleted = 0`,
		orgID, userID, name, updatedAt,
	)
	return err
}

// SoftDeleteEntity marks an entity as deleted in the corresponding table
func (s *Store) SoftDeleteEntity(table, idCol, userID, contactID, id string) error {
	now := time.Now().UnixMilli()
	var query string
	var args []any
	if contactID != "" {
		query = fmt.Sprintf(`UPDATE %s SET deleted = 1, updated_at = $1 WHERE user_id = $2 AND contact_id = $3 AND %s = $4`, table, idCol)
		args = []any{now, userID, contactID, id}
	} else {
		query = fmt.Sprintf(`UPDATE %s SET deleted = 1, updated_at = $1 WHERE user_id = $2 AND %s = $3`, table, idCol)
		args = []any{now, userID, id}
	}
	_, err := s.pool.Exec(context.Background(), query, args...)
	return err
}
