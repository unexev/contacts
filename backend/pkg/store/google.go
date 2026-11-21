package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"contacts/pkg/model"
)

// ErrGoogleConflict is returned when the email belongs to an account already
// linked to a different Google account.
var ErrGoogleConflict = errors.New("email belongs to another google account")

const userColumns = `user_id, email, name, role, status`

func scanUser(row pgx.Row) (model.User, error) {
	var u model.User
	err := row.Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status)
	return u, err
}

// LoginWithGoogle finds or creates the user for a verified Google identity:
//  1. the account already linked to this Google id;
//  2. else the account with the same email, which gets linked (Google has
//     verified the address, so it also counts as verified);
//  3. else a new account without a password.
//
// Linking an account whose email was never verified drops its password and
// sessions: whoever registered it could have used an address that was not
// theirs, and must not keep access once the real owner signs in.
func (s *Store) LoginWithGoogle(sub, email, name string) (model.User, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return model.User{}, err
	}
	defer tx.Rollback(ctx)

	u, err := scanUser(tx.QueryRow(ctx, `SELECT `+userColumns+` FROM app_users WHERE google_sub = $1`, sub))
	if err == nil {
		return u, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return model.User{}, err
	}

	var verified bool
	var linkedSub *string
	var hasRow = true
	err = tx.QueryRow(ctx,
		`SELECT `+userColumns+`, email_verified, google_sub FROM app_users
		  WHERE lower(email) = lower($1) ORDER BY created_at, user_id LIMIT 1 FOR UPDATE`, email,
	).Scan(&u.UserID, &u.Email, &u.Name, &u.Role, &u.Status, &verified, &linkedSub)
	if errors.Is(err, pgx.ErrNoRows) {
		hasRow = false
	} else if err != nil {
		return model.User{}, err
	}

	if hasRow {
		if linkedSub != nil {
			return model.User{}, ErrGoogleConflict
		}
		if _, err := tx.Exec(ctx,
			`UPDATE app_users
			    SET google_sub = $2, email_verified = TRUE,
			        password_hash = CASE WHEN $3 THEN password_hash ELSE '' END
			  WHERE user_id = $1`, u.UserID, sub, verified); err != nil {
			return model.User{}, err
		}
		if !verified {
			if _, err := tx.Exec(ctx,
				`UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
				u.UserID, time.Now().UnixMilli()); err != nil {
				return model.User{}, err
			}
		}
		return u, tx.Commit(ctx)
	}

	u = model.User{UserID: genID("usr"), Email: email, Name: name, Role: "user", Status: "active"}
	_, err = tx.Exec(ctx,
		`INSERT INTO app_users (user_id, email, name, password_hash, role, status, email_verified, google_sub)
		 VALUES ($1, $2, $3, '', $4, $5, TRUE, $6)`,
		u.UserID, u.Email, u.Name, u.Role, u.Status, sub)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return model.User{}, ErrGoogleConflict
	}
	if err != nil {
		return model.User{}, err
	}
	return u, tx.Commit(ctx)
}

// GoogleSubByID returns the Google id linked to the user, or "" when none.
func (s *Store) GoogleSubByID(userID string) (string, error) {
	var sub *string
	err := s.pool.QueryRow(context.Background(),
		`SELECT google_sub FROM app_users WHERE user_id = $1`, userID).Scan(&sub)
	if sub == nil {
		return "", err
	}
	return *sub, err
}
