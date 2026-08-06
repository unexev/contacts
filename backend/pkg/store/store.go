package store

import (
	"context"
	"crypto/rand"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"contacts/pkg/model"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func genID(prefix string) string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%s_%08x%08x", prefix, b[:4], b[4:])
}

func clampLimit(limit int) int {
	if limit <= 0 {
		return 50
	}
	if limit > 100 {
		return 100
	}
	return limit
}

// ──────────────────────────── Auth ────────────────────────────

func (s *Store) Register(email, name, passwordHash string) (model.User, error) {
	u := model.User{
		UserID: genID("usr"),
		Email:  email,
		Name:   name,
		Role:   "user",
		Status: "active",
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO users (user_id, email, name, password_hash, role, status)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		u.UserID, u.Email, u.Name, passwordHash, u.Role, u.Status,
	)
	return u, err
}

func (s *Store) GetUserByEmail(email string) (model.User, error) {
	var u model.User
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, email, name, role, status FROM users WHERE email = $1`, email,
	).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status)
	return u, err
}

func (s *Store) GetUserByEmailWithHash(email string) (model.User, string, error) {
	ctx := context.Background()
	var u model.User
	var hash string
	var err error

	for attempt := 0; attempt < 3; attempt++ {
		err = s.pool.QueryRow(ctx,
			`SELECT user_id, email, name, role, status, password_hash FROM users WHERE email = $1`, email,
		).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status, &hash)
		if err == nil {
			return u, hash, nil
		}
		time.Sleep(time.Duration(100*(attempt+1)) * time.Millisecond)
	}
	return u, hash, err
}

func (s *Store) GetUserByID(userID string) (model.User, error) {
	var u model.User
	err := s.pool.QueryRow(context.Background(),
		`SELECT user_id, email, name, role, status FROM users WHERE user_id = $1`, userID,
	).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status)
	return u, err
}

// ──────────────────────────── Contacts ────────────────────────

func (s *Store) ListContacts(userID, search string, limit, offset int) ([]model.Contact, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int

	var rows pgx.Rows
	var err error

	if search != "" {
		searchPattern := "%" + search + "%"
		s.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM contacts c
			 WHERE c.user_id = $1 AND c.deleted = 0
			   AND (c.first_name ILIKE $2
			        OR c.middle_name ILIKE $2
			        OR c.surname ILIKE $2
			        OR EXISTS (
			            SELECT 1 FROM contact_keywords ck
			            WHERE ck.user_id = c.user_id AND ck.contact_id = c.contact_id
			              AND ck.keyword ILIKE $2
			        ))`,
			userID, searchPattern,
		).Scan(&total)

		rows, err = s.pool.Query(ctx,
			`SELECT c.user_id, c.contact_id, c.first_name, c.middle_name, c.surname,
			        c.birthdate, c.gender, c.status_id, COALESCE(ms.marital_status, ''), c.updated_at
			 FROM contacts c
			 LEFT JOIN marital_status ms ON c.status_id = ms.status_id
			 WHERE c.user_id = $1 AND c.deleted = 0
			   AND (c.first_name ILIKE $2
			        OR c.middle_name ILIKE $2
			        OR c.surname ILIKE $2
			        OR EXISTS (
			            SELECT 1 FROM contact_keywords ck
			            WHERE ck.user_id = c.user_id AND ck.contact_id = c.contact_id
			              AND ck.keyword ILIKE $2
			        ))
			 ORDER BY c.first_name, c.surname
			 LIMIT $3 OFFSET $4`,
			userID, searchPattern, limit, offset,
		)
	} else {
		s.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM contacts c
			 WHERE c.user_id = $1 AND c.deleted = 0`,
			userID,
		).Scan(&total)

		rows, err = s.pool.Query(ctx,
			`SELECT c.user_id, c.contact_id, c.first_name, c.middle_name, c.surname,
			        c.birthdate, c.gender, c.status_id, COALESCE(ms.marital_status, ''), c.updated_at
			 FROM contacts c
			 LEFT JOIN marital_status ms ON c.status_id = ms.status_id
			 WHERE c.user_id = $1 AND c.deleted = 0
			 ORDER BY c.first_name, c.surname
			 LIMIT $2 OFFSET $3`,
			userID, limit, offset,
		)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var contacts []model.Contact
	for rows.Next() {
		var c model.Contact
		if err := rows.Scan(
			&c.UserID, &c.ContactID, &c.FirstName, &c.MiddleName, &c.Surname,
			&c.Birthdate, &c.Gender, &c.StatusID, &c.MaritalStatus, &c.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		contacts = append(contacts, c)
	}
	return contacts, total, rows.Err()
}

func (s *Store) GetContact(userID, contactID string) (model.Contact, error) {
	var c model.Contact
	err := s.pool.QueryRow(context.Background(),
		`SELECT c.user_id, c.contact_id, c.first_name, c.middle_name, c.surname,
		        c.birthdate, c.gender, c.status_id, COALESCE(ms.marital_status, ''), c.updated_at
		 FROM contacts c
		 LEFT JOIN marital_status ms ON c.status_id = ms.status_id
		 WHERE c.user_id = $1 AND c.contact_id = $2 AND c.deleted = 0`,
		userID, contactID,
	).Scan(&c.UserID, &c.ContactID, &c.FirstName, &c.MiddleName, &c.Surname,
		&c.Birthdate, &c.Gender, &c.StatusID, &c.MaritalStatus, &c.UpdatedAt)
	return c, err
}

func (s *Store) CreateContact(userID string, c model.Contact) (model.Contact, error) {
	c.UserID = userID
	if c.ContactID == "" {
		c.ContactID = genID("cnt")
	}
	c.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contacts (user_id, contact_id, first_name, middle_name, surname,
		        birthdate, gender, status_id, updated_at, deleted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`,
		c.UserID, c.ContactID, c.FirstName, c.MiddleName, c.Surname,
		c.Birthdate, c.Gender, c.StatusID, c.UpdatedAt,
	)
	return c, err
}

func (s *Store) UpdateContact(userID string, c model.Contact) error {
	c.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contacts
		 SET first_name = $3, middle_name = $4, surname = $5, birthdate = $6,
		     gender = $7, status_id = $8, updated_at = $9
		 WHERE user_id = $1 AND contact_id = $2 AND deleted = 0`,
		userID, c.ContactID, c.FirstName, c.MiddleName, c.Surname,
		c.Birthdate, c.Gender, c.StatusID, c.UpdatedAt,
	)
	return err
}

func (s *Store) DeleteContact(userID, contactID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contacts SET deleted = 1 WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	)
	return err
}

// ──────────────────────────── Contact Full ────────────────────

func (s *Store) GetContactFull(userID, contactID string) (map[string]interface{}, error) {
	c, err := s.GetContact(userID, contactID)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"user_id":     c.UserID,
		"contact_id":  c.ContactID,
		"first_name":  c.FirstName,
		"middle_name": c.MiddleName,
		"surname":     c.Surname,
		"birthdate":   c.Birthdate,
		"gender":      c.Gender,
		"status_id":   c.StatusID,
		"marital_status": c.MaritalStatus,
		"updated_at":  c.UpdatedAt,
	}

	if phones, _, err := s.ListPhones(userID, contactID, 10000, 0); err == nil {
		result["phones"] = phones
	}
	if emails, _, err := s.ListEmails(userID, contactID, 10000, 0); err == nil {
		result["emails"] = emails
	}
	if urls, _, err := s.ListUrls(userID, contactID, 10000, 0); err == nil {
		result["urls"] = urls
	}
	if notes, _, err := s.ListNotes(userID, contactID, 10000, 0); err == nil {
		result["notes"] = notes
	}
	if keywords, _, err := s.ListKeywords(userID, contactID, 10000, 0); err == nil {
		kws := make([]string, len(keywords))
		for i, k := range keywords {
			kws[i] = k.Keyword
		}
		result["keywords"] = kws
	}
	if cards, _, err := s.ListCards(userID, contactID, 10000, 0); err == nil {
		result["identity_cards"] = cards
	}
	if banks, _, err := s.ListBankAccounts(userID, contactID, 10000, 0); err == nil {
		result["bank_accounts"] = banks
	}
	if rels, _, err := s.ListRelationships(userID, contactID, 10000, 0); err == nil {
		result["relationships"] = rels
	}
	if orgs, _, err := s.ListOrganizations(userID, contactID, 10000, 0); err == nil {
		result["organizations"] = orgs
	}

	return result, nil
}

// ──────────────────────────── Phones ──────────────────────────

func (s *Store) ListPhones(userID, contactID string, limit, offset int) ([]model.ContactPhone, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_phones WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, phone_id, phone, label
		 FROM contact_phones WHERE user_id = $1 AND contact_id = $2
		 ORDER BY phone_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactPhone
	for rows.Next() {
		var p model.ContactPhone
		if err := rows.Scan(&p.UserID, &p.ContactID, &p.PhoneID, &p.Phone, &p.Label); err != nil {
			return nil, 0, err
		}
		items = append(items, p)
	}
	return items, total, rows.Err()
}

func (s *Store) CreatePhone(userID, contactID string, p model.ContactPhone) (model.ContactPhone, error) {
	p.UserID = userID
	p.ContactID = contactID
	if p.PhoneID == "" {
		p.PhoneID = genID("phn")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_phones (user_id, contact_id, phone_id, phone, label)
		 VALUES ($1, $2, $3, $4, $5)`,
		p.UserID, p.ContactID, p.PhoneID, p.Phone, p.Label,
	)
	return p, err
}

func (s *Store) UpdatePhone(userID, contactID string, p model.ContactPhone) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_phones SET phone = $4, label = $5
		 WHERE user_id = $1 AND contact_id = $2 AND phone_id = $3`,
		userID, contactID, p.PhoneID, p.Phone, p.Label,
	)
	return err
}

func (s *Store) DeletePhone(userID, contactID, phoneID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_phones WHERE user_id = $1 AND contact_id = $2 AND phone_id = $3`,
		userID, contactID, phoneID,
	)
	return err
}

// ──────────────────────────── Emails ──────────────────────────

func (s *Store) ListEmails(userID, contactID string, limit, offset int) ([]model.ContactEmail, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_emails WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, email_id, email, label
		 FROM contact_emails WHERE user_id = $1 AND contact_id = $2
		 ORDER BY email_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactEmail
	for rows.Next() {
		var e model.ContactEmail
		if err := rows.Scan(&e.UserID, &e.ContactID, &e.EmailID, &e.Email, &e.Label); err != nil {
			return nil, 0, err
		}
		items = append(items, e)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateEmail(userID, contactID string, e model.ContactEmail) (model.ContactEmail, error) {
	e.UserID = userID
	e.ContactID = contactID
	if e.EmailID == "" {
		e.EmailID = genID("eml")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_emails (user_id, contact_id, email_id, email, label)
		 VALUES ($1, $2, $3, $4, $5)`,
		e.UserID, e.ContactID, e.EmailID, e.Email, e.Label,
	)
	return e, err
}

func (s *Store) UpdateEmail(userID, contactID string, e model.ContactEmail) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_emails SET email = $4, label = $5
		 WHERE user_id = $1 AND contact_id = $2 AND email_id = $3`,
		userID, contactID, e.EmailID, e.Email, e.Label,
	)
	return err
}

func (s *Store) DeleteEmail(userID, contactID, emailID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_emails WHERE user_id = $1 AND contact_id = $2 AND email_id = $3`,
		userID, contactID, emailID,
	)
	return err
}

// ──────────────────────────── URLs ────────────────────────────

func (s *Store) ListUrls(userID, contactID string, limit, offset int) ([]model.ContactUrl, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_urls WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, url_id, url, label
		 FROM contact_urls WHERE user_id = $1 AND contact_id = $2
		 ORDER BY url_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactUrl
	for rows.Next() {
		var u model.ContactUrl
		if err := rows.Scan(&u.UserID, &u.ContactID, &u.URLID, &u.URL, &u.Label); err != nil {
			return nil, 0, err
		}
		items = append(items, u)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateUrl(userID, contactID string, u model.ContactUrl) (model.ContactUrl, error) {
	u.UserID = userID
	u.ContactID = contactID
	if u.URLID == "" {
		u.URLID = genID("url")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_urls (user_id, contact_id, url_id, url, label)
		 VALUES ($1, $2, $3, $4, $5)`,
		u.UserID, u.ContactID, u.URLID, u.URL, u.Label,
	)
	return u, err
}

func (s *Store) UpdateUrl(userID, contactID string, u model.ContactUrl) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_urls SET url = $4, label = $5
		 WHERE user_id = $1 AND contact_id = $2 AND url_id = $3`,
		userID, contactID, u.URLID, u.URL, u.Label,
	)
	return err
}

func (s *Store) DeleteUrl(userID, contactID, urlID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_urls WHERE user_id = $1 AND contact_id = $2 AND url_id = $3`,
		userID, contactID, urlID,
	)
	return err
}

// ──────────────────────────── Notes ───────────────────────────

func (s *Store) ListNotes(userID, contactID string, limit, offset int) ([]model.ContactNote, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_notes WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, note_id, note, updated_at
		 FROM contact_notes WHERE user_id = $1 AND contact_id = $2
		 ORDER BY updated_at DESC
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactNote
	for rows.Next() {
		var n model.ContactNote
		if err := rows.Scan(&n.UserID, &n.ContactID, &n.NoteID, &n.Note, &n.UpdatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, n)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateNote(userID, contactID string, n model.ContactNote) (model.ContactNote, error) {
	n.UserID = userID
	n.ContactID = contactID
	if n.NoteID == "" {
		n.NoteID = genID("nte")
	}
	n.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_notes (user_id, contact_id, note_id, note, updated_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		n.UserID, n.ContactID, n.NoteID, n.Note, n.UpdatedAt,
	)
	return n, err
}

func (s *Store) UpdateNote(userID, contactID string, n model.ContactNote) error {
	n.UpdatedAt = time.Now().UnixMilli()
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_notes SET note = $4, updated_at = $5
		 WHERE user_id = $1 AND contact_id = $2 AND note_id = $3`,
		userID, contactID, n.NoteID, n.Note, n.UpdatedAt,
	)
	return err
}

func (s *Store) DeleteNote(userID, contactID, noteID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_notes WHERE user_id = $1 AND contact_id = $2 AND note_id = $3`,
		userID, contactID, noteID,
	)
	return err
}

// ──────────────────────────── Keywords ────────────────────────

func (s *Store) ListKeywords(userID, contactID string, limit, offset int) ([]model.ContactKeyword, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_keywords WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, keyword
		 FROM contact_keywords WHERE user_id = $1 AND contact_id = $2
		 ORDER BY keyword
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactKeyword
	for rows.Next() {
		var k model.ContactKeyword
		if err := rows.Scan(&k.UserID, &k.ContactID, &k.Keyword); err != nil {
			return nil, 0, err
		}
		items = append(items, k)
	}
	return items, total, rows.Err()
}

func (s *Store) AddKeyword(userID, contactID, keyword string) error {
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_keywords (user_id, contact_id, keyword)
		 VALUES ($1, $2, $3)`,
		userID, contactID, keyword,
	)
	return err
}

func (s *Store) DeleteKeyword(userID, contactID, keyword string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_keywords WHERE user_id = $1 AND contact_id = $2 AND keyword = $3`,
		userID, contactID, keyword,
	)
	return err
}

// ──────────────────────────── Identity Cards ──────────────────

func (s *Store) ListCards(userID, contactID string, limit, offset int) ([]model.IdentityCard, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM identity_cards WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, card_id, doc_type, card_number, issue_date, expiry_date
		 FROM identity_cards WHERE user_id = $1 AND contact_id = $2
		 ORDER BY card_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.IdentityCard
	for rows.Next() {
		var c model.IdentityCard
		if err := rows.Scan(&c.UserID, &c.ContactID, &c.CardID, &c.DocType,
			&c.CardNumber, &c.IssueDate, &c.ExpiryDate); err != nil {
			return nil, 0, err
		}
		items = append(items, c)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateCard(userID, contactID string, c model.IdentityCard) (model.IdentityCard, error) {
	c.UserID = userID
	c.ContactID = contactID
	if c.CardID == "" {
		c.CardID = genID("crd")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO identity_cards (user_id, contact_id, card_id, doc_type, card_number, issue_date, expiry_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		c.UserID, c.ContactID, c.CardID, c.DocType, c.CardNumber, c.IssueDate, c.ExpiryDate,
	)
	return c, err
}

func (s *Store) UpdateCard(userID, contactID string, c model.IdentityCard) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE identity_cards SET doc_type = $4, card_number = $5, issue_date = $6, expiry_date = $7
		 WHERE user_id = $1 AND contact_id = $2 AND card_id = $3`,
		userID, contactID, c.CardID, c.DocType, c.CardNumber, c.IssueDate, c.ExpiryDate,
	)
	return err
}

func (s *Store) DeleteCard(userID, contactID, cardID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM identity_cards WHERE user_id = $1 AND contact_id = $2 AND card_id = $3`,
		userID, contactID, cardID,
	)
	return err
}

// ──────────────────────────── Bank Accounts ───────────────────

func (s *Store) ListBankAccounts(userID, contactID string, limit, offset int) ([]model.ContactBankAccount, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_bank_accounts WHERE user_id = $1 AND contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT user_id, contact_id, bank_account_id, bank_name, account_number, account_type, label
		 FROM contact_bank_accounts WHERE user_id = $1 AND contact_id = $2
		 ORDER BY bank_account_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactBankAccount
	for rows.Next() {
		var b model.ContactBankAccount
		if err := rows.Scan(&b.UserID, &b.ContactID, &b.BankAccountID, &b.BankName,
			&b.AccountNumber, &b.AccountType, &b.Label); err != nil {
			return nil, 0, err
		}
		items = append(items, b)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateBankAccount(userID, contactID string, b model.ContactBankAccount) (model.ContactBankAccount, error) {
	b.UserID = userID
	b.ContactID = contactID
	if b.BankAccountID == "" {
		b.BankAccountID = genID("bak")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_bank_accounts (user_id, contact_id, bank_account_id, bank_name, account_number, account_type, label)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		b.UserID, b.ContactID, b.BankAccountID, b.BankName, b.AccountNumber, b.AccountType, b.Label,
	)
	return b, err
}

func (s *Store) UpdateBankAccount(userID, contactID string, b model.ContactBankAccount) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_bank_accounts SET bank_name = $4, account_number = $5, account_type = $6, label = $7
		 WHERE user_id = $1 AND contact_id = $2 AND bank_account_id = $3`,
		userID, contactID, b.BankAccountID, b.BankName, b.AccountNumber, b.AccountType, b.Label,
	)
	return err
}

func (s *Store) DeleteBankAccount(userID, contactID, bankAccountID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_bank_accounts WHERE user_id = $1 AND contact_id = $2 AND bank_account_id = $3`,
		userID, contactID, bankAccountID,
	)
	return err
}

// ──────────────────────────── Relationships ───────────────────

func (s *Store) ListRelationships(userID, contactID string, limit, offset int) ([]model.ContactRelationship, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_relationships r WHERE r.user_id = $1 AND r.contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT r.user_id, r.contact_id, r.related_contact_id,
		        COALESCE(c.first_name || ' ' || c.surname, '') AS related_contact_name,
		        r.type_id, rt.label AS type_label
		 FROM contact_relationships r
		 LEFT JOIN contacts c ON c.user_id = r.user_id AND c.contact_id = r.related_contact_id
		 LEFT JOIN relationship_types rt ON rt.type_id = r.type_id
		 WHERE r.user_id = $1 AND r.contact_id = $2
		 ORDER BY r.related_contact_id
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactRelationship
	for rows.Next() {
		var r model.ContactRelationship
		if err := rows.Scan(&r.UserID, &r.ContactID, &r.RelatedContactID,
			&r.RelatedContactName, &r.TypeID, &r.TypeLabel); err != nil {
			return nil, 0, err
		}
		items = append(items, r)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateRelationship(userID, contactID string, r model.ContactRelationship) (model.ContactRelationship, error) {
	r.UserID = userID
	r.ContactID = contactID
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_relationships (user_id, contact_id, related_contact_id, type_id)
		 VALUES ($1, $2, $3, $4)`,
		r.UserID, r.ContactID, r.RelatedContactID, r.TypeID,
	)
	return r, err
}

func (s *Store) DeleteRelationship(userID, contactID, relatedContactID, typeID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_relationships
		 WHERE user_id = $1 AND contact_id = $2 AND related_contact_id = $3 AND type_id = $4`,
		userID, contactID, relatedContactID, typeID,
	)
	return err
}

// ──────────────────────────── Contact Organizations ───────────

func (s *Store) ListOrganizations(userID, contactID string, limit, offset int) ([]model.ContactOrganization, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contact_organizations co WHERE co.user_id = $1 AND co.contact_id = $2`,
		userID, contactID,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT co.user_id, co.contact_id, co.organization_id, o.name AS organization_name,
		        co.achievement, co.date
		 FROM contact_organizations co
		 LEFT JOIN organizations o ON o.organization_id = co.organization_id
		 WHERE co.user_id = $1 AND co.contact_id = $2
		 ORDER BY co.date DESC
		 LIMIT $3 OFFSET $4`,
		userID, contactID, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.ContactOrganization
	for rows.Next() {
		var o model.ContactOrganization
		if err := rows.Scan(&o.UserID, &o.ContactID, &o.OrganizationID,
			&o.OrganizationName, &o.Achievement, &o.Date); err != nil {
			return nil, 0, err
		}
		items = append(items, o)
	}
	return items, total, rows.Err()
}

func (s *Store) CreateOrganization(userID, contactID string, o model.ContactOrganization) (model.ContactOrganization, error) {
	o.UserID = userID
	o.ContactID = contactID
	if o.OrganizationID == "" {
		o.OrganizationID = genID("org")
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO contact_organizations (user_id, contact_id, organization_id, achievement, date)
		 VALUES ($1, $2, $3, $4, $5)`,
		o.UserID, o.ContactID, o.OrganizationID, o.Achievement, o.Date,
	)
	return o, err
}

func (s *Store) UpdateOrganization(userID, contactID string, o model.ContactOrganization) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE contact_organizations SET achievement = $4, date = $5
		 WHERE user_id = $1 AND contact_id = $2 AND organization_id = $3`,
		userID, contactID, o.OrganizationID, o.Achievement, o.Date,
	)
	return err
}

func (s *Store) DeleteOrganization(userID, contactID, organizationID string) error {
	_, err := s.pool.Exec(context.Background(),
		`DELETE FROM contact_organizations
		 WHERE user_id = $1 AND contact_id = $2 AND organization_id = $3`,
		userID, contactID, organizationID,
	)
	return err
}

// ──────────────────────────── Reference tables ────────────────

func (s *Store) ListMaritalStatuses() ([]model.MaritalStatus, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT status_id, marital_status FROM marital_status ORDER BY status_id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.MaritalStatus
	for rows.Next() {
		var ms model.MaritalStatus
		if err := rows.Scan(&ms.StatusID, &ms.MaritalStatus); err != nil {
			return nil, err
		}
		items = append(items, ms)
	}
	return items, rows.Err()
}

func (s *Store) ListRelationshipTypes() ([]model.RelationshipType, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT type_id, label FROM relationship_types ORDER BY type_id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.RelationshipType
	for rows.Next() {
		var rt model.RelationshipType
		if err := rows.Scan(&rt.TypeID, &rt.Label); err != nil {
			return nil, err
		}
		items = append(items, rt)
	}
	return items, rows.Err()
}

func (s *Store) ListOrganizationsByUser(userID string) ([]model.Organization, error) {
	rows, err := s.pool.Query(context.Background(),
		`SELECT DISTINCT o.organization_id, o.name
		 FROM contact_organizations co
		 JOIN organizations o ON o.organization_id = co.organization_id
		 WHERE co.user_id = $1
		 ORDER BY o.name`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.Organization
	for rows.Next() {
		var o model.Organization
		if err := rows.Scan(&o.OrganizationID, &o.Name); err != nil {
			return nil, err
		}
		items = append(items, o)
	}
	return items, rows.Err()
}

func (s *Store) CreateOrganizationForUser(userID, name string) (model.Organization, error) {
	o := model.Organization{
		OrganizationID: genID("org"),
		Name:           name,
	}
	_, err := s.pool.Exec(context.Background(),
		`INSERT INTO organizations (organization_id, name) VALUES ($1, $2)`,
		o.OrganizationID, o.Name,
	)
	return o, err
}

// ──────────────────────────── Birthdays ───────────────────────

func (s *Store) GetBirthdaysThisMonth(userID string, month, year, limit, offset int) ([]model.Contact, int, error) {
	ctx := context.Background()
	limit = clampLimit(limit)
	if offset < 0 {
		offset = 0
	}
	var total int
	s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM contacts c
		 WHERE c.user_id = $1 AND c.deleted = 0
		   AND EXTRACT(MONTH FROM c.birthdate::date) = $2
		   AND EXTRACT(YEAR  FROM c.birthdate::date) = $3`,
		userID, month, year,
	).Scan(&total)

	rows, err := s.pool.Query(ctx,
		`SELECT c.user_id, c.contact_id, c.first_name, c.middle_name, c.surname,
		        c.birthdate, c.gender, c.status_id, COALESCE(ms.marital_status, ''), c.updated_at
		 FROM contacts c
		 LEFT JOIN marital_status ms ON c.status_id = ms.status_id
		 WHERE c.user_id = $1 AND c.deleted = 0
		   AND EXTRACT(MONTH FROM c.birthdate::date) = $2
		   AND EXTRACT(YEAR  FROM c.birthdate::date) = $3
		 ORDER BY EXTRACT(DAY FROM c.birthdate::date)
		 LIMIT $4 OFFSET $5`,
		userID, month, year, limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var items []model.Contact
	for rows.Next() {
		var c model.Contact
		if err := rows.Scan(&c.UserID, &c.ContactID, &c.FirstName, &c.MiddleName,
			&c.Surname, &c.Birthdate, &c.Gender, &c.StatusID,
			&c.MaritalStatus, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, c)
	}
	return items, total, rows.Err()
}
