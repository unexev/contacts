package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// ErrInvalidVerificationToken is returned for an unknown, expired or already
// used token, or one issued for an address the user no longer has.
var ErrInvalidVerificationToken = errors.New("invalid verification token")

// CreateEmailVerification replaces the user's pending tokens with a new one
// for email and returns the raw token, which is never stored.
func (s *Store) CreateEmailVerification(userID, email string, ttl time.Duration) (string, error) {
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	if _, err := tx.Exec(ctx,
		`DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at < $2`,
		userID, now.UnixMilli()); err != nil {
		return "", err
	}
	raw := newRefreshToken()
	if _, err := tx.Exec(ctx,
		`INSERT INTO email_verification_tokens (token_hash, user_id, email, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		hashRefreshToken(raw), userID, email, now.Add(ttl).UnixMilli(), now.UnixMilli()); err != nil {
		return "", err
	}
	return raw, tx.Commit(ctx)
}

// VerifyEmail consumes the token and marks the user's email as verified.
func (s *Store) VerifyEmail(raw string) error {
	if raw == "" {
		return ErrInvalidVerificationToken
	}
	ctx := context.Background()
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var userID, email string
	var expiresAt int64
	err = tx.QueryRow(ctx,
		`DELETE FROM email_verification_tokens WHERE token_hash = $1
		 RETURNING user_id, email, expires_at`, hashRefreshToken(raw),
	).Scan(&userID, &email, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidVerificationToken
	}
	if err != nil {
		return err
	}
	if expiresAt < time.Now().UnixMilli() {
		return ErrInvalidVerificationToken
	}
	tag, err := tx.Exec(ctx,
		`UPDATE app_users SET email_verified = TRUE WHERE user_id = $1 AND lower(email) = lower($2)`,
		userID, email)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrInvalidVerificationToken
	}
	return tx.Commit(ctx)
}

// IsEmailVerified reports whether the user's current email is verified.
func (s *Store) IsEmailVerified(userID string) (bool, error) {
	var ok bool
	err := s.pool.QueryRow(context.Background(),
		`SELECT email_verified FROM app_users WHERE user_id = $1`, userID).Scan(&ok)
	return ok, err
}
