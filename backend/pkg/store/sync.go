package store

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"contacts/pkg/model"
)

// SyncRow wraps an entity with a Deleted flag for tombstone support.
type SyncRow[T any] struct {
	Row     T
	Deleted bool
}

func (r SyncRow[T]) MarshalJSON() ([]byte, error) {
	rowJSON, err := json.Marshal(r.Row)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(rowJSON, &fields); err != nil {
		return nil, err
	}
	if fields["deleted"], err = json.Marshal(r.Deleted); err != nil {
		return nil, err
	}
	return json.Marshal(fields)
}

// Sub-entidades con updated_at explícito para sync cuando sea necesario
type SyncPhone struct {
	model.ContactPhone
	UpdatedAt int64 `json:"updated_at"`
}

type SyncEmail struct {
	model.ContactEmail
	UpdatedAt int64 `json:"updated_at"`
}

type SyncUrl struct {
	model.ContactUrl
	UpdatedAt int64 `json:"updated_at"`
}

type SyncKeyword struct {
	model.ContactKeyword
	UpdatedAt int64 `json:"updated_at"`
}

type SyncIdentityCard struct {
	model.IdentityCard
	UpdatedAt int64 `json:"updated_at"`
}

type SyncBankAccount struct {
	model.ContactBankAccount
	UpdatedAt int64 `json:"updated_at"`
}

type SyncRelationship struct {
	model.ContactRelationship
	UpdatedAt int64 `json:"updated_at"`
}

type SyncContactOrg struct {
	model.ContactOrganization
	UpdatedAt int64 `json:"updated_at"`
}

type SyncLocation struct {
	model.ContactLocation
	UpdatedAt int64 `json:"updated_at"`
}

type SyncNationality struct {
	model.ContactNationality
	UpdatedAt int64 `json:"updated_at"`
}

type SyncOrganization struct {
	model.Organization
	UpdatedAt int64 `json:"updated_at"`
}

// SyncChanges is everything one user changed since a cursor.
type SyncChanges struct {
	Cursor         int64                         `json:"cursor"`
	Contacts       []SyncRow[model.Contact]      `json:"contacts"`
	Phones         []SyncRow[SyncPhone]          `json:"phones"`
	Emails         []SyncRow[SyncEmail]          `json:"emails"`
	Urls           []SyncRow[SyncUrl]            `json:"urls"`
	Notes          []SyncRow[model.ContactNote]  `json:"notes"`
	Keywords       []SyncRow[SyncKeyword]        `json:"keywords"`
	IdentityCards  []SyncRow[SyncIdentityCard]   `json:"identity_cards"`
	BankAccounts   []SyncRow[SyncBankAccount]    `json:"bank_accounts"`
	Relationships  []SyncRow[SyncRelationship]   `json:"relationships"`
	Organizations  []SyncRow[SyncOrganization]   `json:"organizations"`
	ContactOrgs    []SyncRow[SyncContactOrg]     `json:"contact_organizations"`
	Locations      []SyncRow[SyncLocation]       `json:"locations"`
	Nationalities  []SyncRow[SyncNationality]    `json:"nationalities"`
}

func syncRows[T any](ctx context.Context, tx pgx.Tx, query string, userID string, since int64, scan func(pgx.Rows, *T, *int) error) ([]SyncRow[T], error) {
	rows, err := tx.Query(ctx, query, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []SyncRow[T]{}
	for rows.Next() {
		var item SyncRow[T]
		var deleted int
		if err := scan(rows, &item.Row, &deleted); err != nil {
			return nil, err
		}
		item.Deleted = deleted != 0
		items = append(items, item)
	}
	return items, rows.Err()
}

// SyncCursorOverlapMs trails cursor to avoid races between write & commit.
const SyncCursorOverlapMs int64 = 5000

func syncCursor(now time.Time) int64 {
	return max(now.UnixMilli()-SyncCursorOverlapMs, 0)
}

// SyncChanges pulls all entities modified since `since` for a specific user.
func (s *Store) SyncChanges(userID string, since int64) (SyncChanges, error) {
	ctx := context.Background()
	out := SyncChanges{
		Cursor:        syncCursor(time.Now()),
		Contacts:      []SyncRow[model.Contact]{},
		Phones:        []SyncRow[SyncPhone]{},
		Emails:        []SyncRow[SyncEmail]{},
		Urls:          []SyncRow[SyncUrl]{},
		Notes:         []SyncRow[model.ContactNote]{},
		Keywords:      []SyncRow[SyncKeyword]{},
		IdentityCards: []SyncRow[SyncIdentityCard]{},
		BankAccounts:  []SyncRow[SyncBankAccount]{},
		Relationships: []SyncRow[SyncRelationship]{},
		Organizations: []SyncRow[SyncOrganization]{},
		ContactOrgs:   []SyncRow[SyncContactOrg]{},
		Locations:     []SyncRow[SyncLocation]{},
		Nationalities: []SyncRow[SyncNationality]{},
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return SyncChanges{}, err
	}
	defer tx.Rollback(ctx)

	// Contacts
	if out.Contacts, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, first_name, middle_name, surname, birthdate, gender, status_id, deceased, updated_at, created_at, COALESCE(deleted, 0)
		 FROM contacts WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, contact_id`,
		userID, since,
		func(r pgx.Rows, c *model.Contact, deleted *int) error {
			return r.Scan(&c.UserID, &c.ContactID, &c.FirstName, &c.MiddleName, &c.Surname,
				&c.Birthdate, &c.Gender, &c.StatusID, &c.Deceased, &c.UpdatedAt, &c.CreatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Phones
	if out.Phones, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, phone_id, phone, label, created_at, is_active, updated_at, COALESCE(deleted, 0)
		 FROM contact_phones WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, phone_id`,
		userID, since,
		func(r pgx.Rows, p *SyncPhone, deleted *int) error {
			return r.Scan(&p.UserID, &p.ContactID, &p.PhoneID, &p.Phone, &p.Label, &p.CreatedAt, &p.IsActive, &p.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Emails
	if out.Emails, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, email_id, email, label, updated_at, COALESCE(deleted, 0)
		 FROM contact_emails WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, email_id`,
		userID, since,
		func(r pgx.Rows, e *SyncEmail, deleted *int) error {
			return r.Scan(&e.UserID, &e.ContactID, &e.EmailID, &e.Email, &e.Label, &e.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// URLs
	if out.Urls, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, url_id, url, label, updated_at, COALESCE(deleted, 0)
		 FROM contact_urls WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, url_id`,
		userID, since,
		func(r pgx.Rows, u *SyncUrl, deleted *int) error {
			return r.Scan(&u.UserID, &u.ContactID, &u.URLID, &u.URL, &u.Label, &u.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Notes
	if out.Notes, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, note_id, note, updated_at, COALESCE(deleted, 0)
		 FROM contact_notes WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, note_id`,
		userID, since,
		func(r pgx.Rows, n *model.ContactNote, deleted *int) error {
			return r.Scan(&n.UserID, &n.ContactID, &n.NoteID, &n.Note, &n.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Keywords
	if out.Keywords, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, keyword, updated_at, COALESCE(deleted, 0)
		 FROM contact_keywords WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, keyword`,
		userID, since,
		func(r pgx.Rows, k *SyncKeyword, deleted *int) error {
			return r.Scan(&k.UserID, &k.ContactID, &k.Keyword, &k.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Identity Cards
	if out.IdentityCards, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, card_id, doc_type, card_number, issue_date, expiry_date, country_code, updated_at, COALESCE(deleted, 0)
		 FROM identity_cards WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, card_id`,
		userID, since,
		func(r pgx.Rows, c *SyncIdentityCard, deleted *int) error {
			return r.Scan(&c.UserID, &c.ContactID, &c.CardID, &c.DocType, &c.CardNumber,
				&c.IssueDate, &c.ExpiryDate, &c.CountryCode, &c.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Bank Accounts
	if out.BankAccounts, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, bank_account_id, bank_name, account_number, account_type, label, updated_at, COALESCE(deleted, 0)
		 FROM contact_bank_accounts WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, bank_account_id`,
		userID, since,
		func(r pgx.Rows, b *SyncBankAccount, deleted *int) error {
			return r.Scan(&b.UserID, &b.ContactID, &b.BankAccountID, &b.BankName, &b.AccountNumber, &b.AccountType, &b.Label, &b.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Relationships
	if out.Relationships, err = syncRows(ctx, tx,
		`SELECT cr.user_id, cr.contact_id, cr.related_contact_id, cr.type_id,
		        COALESCE(c.first_name || ' ' || c.surname, ''),
		        COALESCE(rt.label, ''), cr.updated_at, COALESCE(cr.deleted, 0)
		 FROM contact_relationships cr
		 LEFT JOIN contacts c ON c.user_id = cr.user_id AND c.contact_id = cr.related_contact_id
		 LEFT JOIN relationship_types rt ON rt.type_id = cr.type_id
		 WHERE cr.user_id = $1 AND cr.updated_at >= $2 ORDER BY cr.updated_at, cr.related_contact_id`,
		userID, since,
		func(r pgx.Rows, rel *SyncRelationship, deleted *int) error {
			return r.Scan(&rel.UserID, &rel.ContactID, &rel.RelatedContactID, &rel.TypeID,
				&rel.RelatedContactName, &rel.TypeLabel, &rel.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Organizations
	if out.Organizations, err = syncRows(ctx, tx,
		`SELECT organization_id, user_id, name, updated_at, COALESCE(deleted, 0)
		 FROM organizations WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, organization_id`,
		userID, since,
		func(r pgx.Rows, o *SyncOrganization, deleted *int) error {
			return r.Scan(&o.OrganizationID, &o.UserID, &o.Name, &o.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Contact Organizations
	if out.ContactOrgs, err = syncRows(ctx, tx,
		`SELECT co.user_id, co.contact_id, co.organization_id, COALESCE(o.name, ''), co.achievement, co.date, co.updated_at, COALESCE(co.deleted, 0)
		 FROM contact_organizations co
		 LEFT JOIN organizations o ON o.organization_id = co.organization_id
		 WHERE co.user_id = $1 AND co.updated_at >= $2 ORDER BY co.updated_at, co.organization_id`,
		userID, since,
		func(r pgx.Rows, co *SyncContactOrg, deleted *int) error {
			return r.Scan(&co.UserID, &co.ContactID, &co.OrganizationID, &co.OrganizationName,
				&co.Achievement, &co.Date, &co.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Locations
	if out.Locations, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, location_id, location_type, address, city, region, country, postal_code, latitude, longitude, updated_at, COALESCE(deleted, 0)
		 FROM contact_locations WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, location_id`,
		userID, since,
		func(r pgx.Rows, l *SyncLocation, deleted *int) error {
			return r.Scan(&l.UserID, &l.ContactID, &l.LocationID, &l.LocationType, &l.Address,
				&l.City, &l.Region, &l.Country, &l.PostalCode, &l.Latitude, &l.Longitude, &l.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	// Nationalities
	if out.Nationalities, err = syncRows(ctx, tx,
		`SELECT user_id, contact_id, nationality_id, country_code, acquired_at, note, updated_at, COALESCE(deleted, 0)
		 FROM contact_nationalities WHERE user_id = $1 AND updated_at >= $2 ORDER BY updated_at, nationality_id`,
		userID, since,
		func(r pgx.Rows, n *SyncNationality, deleted *int) error {
			return r.Scan(&n.UserID, &n.ContactID, &n.NationalityID, &n.CountryCode, &n.AcquiredAt, &n.Note, &n.UpdatedAt, deleted)
		}); err != nil {
		return SyncChanges{}, err
	}

	return out, nil
}
