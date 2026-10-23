package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// ErrEmailTaken is returned when the new email belongs to another user.
var ErrEmailTaken = errors.New("email already in use")

// GetPasswordHashByID returns the user's current bcrypt hash.
func (s *Store) GetPasswordHashByID(userID string) (string, error) {
	var hash string
	err := s.pool.QueryRow(context.Background(),
		`SELECT password_hash FROM app_users WHERE user_id = $1`, userID).Scan(&hash)
	return hash, err
}

// UpdateCredentials sets the email and/or password hash; empty values are left
// unchanged.
func (s *Store) UpdateCredentials(userID, newEmail, newPasswordHash string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE app_users
		    SET email = COALESCE(NULLIF($2, ''), email),
		        password_hash = COALESCE(NULLIF($3, ''), password_hash)
		  WHERE user_id = $1`,
		userID, newEmail, newPasswordHash)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrEmailTaken
	}
	return err
}

// RevokeAllRefreshTokens revokes every active refresh token of the user.
func (s *Store) RevokeAllRefreshTokens(userID string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL`,
		userID, time.Now().UnixMilli())
	return err
}
