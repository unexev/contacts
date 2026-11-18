package store

import (
	"context"
	"fmt"
)

// userOwnedTables lists every table holding a user's rows, children first so
// no delete trips a foreign key. contact_organizations points at
// organizations, which is per user, so it goes before it.
var userOwnedTables = []string{
	"contact_organizations",
	"contact_relationships",
	"contact_bank_accounts",
	"identity_cards",
	"contact_keywords",
	"contact_notes",
	"contact_urls",
	"contact_emails",
	"contact_phones",
	"contact_locations",
	"contact_nationalities",
	"contacts",
	"organizations",
	"sync_changes",
	"refresh_tokens",
	"email_verification_tokens",
}

// DeleteAccount permanently removes the user and everything they own in one
// transaction. It returns the storage paths of the contact photos so the
// caller can delete the objects.
func (s *Store) DeleteAccount(userID string) ([]string, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	rows, err := tx.Query(ctx,
		`SELECT photo_path FROM contacts WHERE user_id = $1 AND photo_path IS NOT NULL AND photo_path <> ''`, userID)
	if err != nil {
		return nil, err
	}
	var photos []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			rows.Close()
			return nil, err
		}
		photos = append(photos, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for _, table := range userOwnedTables {
		if _, err := tx.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE user_id = $1`, table), userID); err != nil {
			return nil, fmt.Errorf("delete %s: %w", table, err)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM app_users WHERE user_id = $1`, userID); err != nil {
		return nil, err
	}
	return photos, tx.Commit(ctx)
}
