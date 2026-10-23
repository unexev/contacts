package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"contacts/pkg/model"
)

// ErrInvalidRefreshToken is returned for every refresh failure -- unknown,
// expired, revoked or reused token, or an inactive user -- so callers cannot
// tell the cases apart and the token table is not an existence oracle.
var ErrInvalidRefreshToken = errors.New("invalid refresh token")

// refreshPurgeAfter is how long past its expiry a refresh token row is kept
// before the owner's next login or refresh deletes it.
const refreshPurgeAfter = 7 * 24 * time.Hour

// hashRefreshToken returns the SHA-256 hex of a raw token. Tokens carry 256
// bits of entropy, so a plain unsalted hash with a keyed lookup is enough.
func hashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// newRefreshToken returns 32 random bytes, base64url-encoded.
func newRefreshToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(fmt.Sprintf("store: failed to read random bytes for refresh token: %v", err))
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

// refreshExec is the subset of pgx shared by the pool and a transaction.
type refreshExec interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// purgeExpiredRefreshTokens deletes the user's rows that expired more than
// refreshPurgeAfter ago.
func purgeExpiredRefreshTokens(ctx context.Context, q refreshExec, userID string, now time.Time) error {
	_, err := q.Exec(ctx,
		`DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < $2`,
		userID, now.Add(-refreshPurgeAfter).UnixMilli())
	return err
}

func insertRefreshToken(ctx context.Context, q refreshExec, userID, familyID string, now time.Time, ttl time.Duration) (string, error) {
	raw := newRefreshToken()
	_, err := q.Exec(ctx,
		`INSERT INTO refresh_tokens (token_hash, user_id, family_id, created_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		hashRefreshToken(raw), userID, familyID, now.UnixMilli(), now.Add(ttl).UnixMilli())
	if err != nil {
		return "", err
	}
	return raw, nil
}

// IssueRefreshToken starts a new token family for the user (register/login)
// and returns the raw token, which is never stored.
func (s *Store) IssueRefreshToken(userID string, ttl time.Duration) (string, error) {
	ctx := context.Background()
	now := time.Now()
	if err := purgeExpiredRefreshTokens(ctx, s.pool, userID, now); err != nil {
		return "", err
	}
	return insertRefreshToken(ctx, s.pool, userID, genID("rtf"), now, ttl)
}

// RotateRefreshToken atomically revokes the presented token and issues a
// successor in the same family.
func (s *Store) RotateRefreshToken(raw string, ttl, grace time.Duration) (model.User, string, error) {
	ctx := context.Background()
	var user model.User
	if raw == "" {
		return user, "", ErrInvalidRefreshToken
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return user, "", err
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	hash := hashRefreshToken(raw)
	var userID, familyID string
	err = tx.QueryRow(ctx,
		`SELECT user_id, family_id FROM refresh_tokens WHERE token_hash = $1`, hash,
	).Scan(&userID, &familyID)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, "", ErrInvalidRefreshToken
	}
	if err != nil {
		return user, "", err
	}

	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, familyID); err != nil {
		return user, "", err
	}

	retry := false
	var rotatedUser string
	err = tx.QueryRow(ctx,
		`UPDATE refresh_tokens SET revoked_at = $2, rotated_at = $2
		  WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2
		RETURNING user_id`, hash, now.UnixMilli(),
	).Scan(&rotatedUser)
	if errors.Is(err, pgx.ErrNoRows) {
		var revoked bool
		var rotatedAt *int64
		var expiresAt int64
		if err := tx.QueryRow(ctx,
			`SELECT revoked_at IS NOT NULL, rotated_at, expires_at FROM refresh_tokens WHERE token_hash = $1`, hash,
		).Scan(&revoked, &rotatedAt, &expiresAt); err != nil {
			return user, "", err
		}
		if !revoked {
			return user, "", ErrInvalidRefreshToken // expired
		}
		retry = grace > 0 && rotatedAt != nil && expiresAt > now.UnixMilli() &&
			now.UnixMilli()-*rotatedAt <= grace.Milliseconds()
		if retry {
			var burned bool
			if err := tx.QueryRow(ctx,
				`SELECT EXISTS (SELECT 1 FROM refresh_tokens
				  WHERE family_id = $1 AND revoked_at IS NOT NULL AND rotated_at IS NULL)`, familyID,
			).Scan(&burned); err != nil {
				return user, "", err
			}
			retry = !burned
		}
		if !retry {
			if err := revokeFamily(ctx, tx, familyID, now); err != nil {
				return user, "", err
			}
			if err := tx.Commit(ctx); err != nil {
				return user, "", err
			}
			return user, "", ErrInvalidRefreshToken
		}
	} else if err != nil {
		return user, "", err
	}

	err = tx.QueryRow(ctx,
		`SELECT user_id, email, name, role, status FROM app_users WHERE user_id = $1`, userID,
	).Scan(&user.UserID, &user.Email, &user.Name, &user.Role, &user.Status)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && user.Status != "active") {
		if err := revokeFamily(ctx, tx, familyID, now); err != nil {
			return model.User{}, "", err
		}
		if err := tx.Commit(ctx); err != nil {
			return model.User{}, "", err
		}
		return model.User{}, "", ErrInvalidRefreshToken
	}
	if err != nil {
		return model.User{}, "", err
	}

	if retry {
		if _, err := tx.Exec(ctx,
			`UPDATE refresh_tokens SET revoked_at = $2, rotated_at = $2
			  WHERE family_id = $1 AND revoked_at IS NULL`, familyID, now.UnixMilli()); err != nil {
			return model.User{}, "", err
		}
	}
	if err := purgeExpiredRefreshTokens(ctx, tx, userID, now); err != nil {
		return model.User{}, "", err
	}
	next, err := insertRefreshToken(ctx, tx, userID, familyID, now, ttl)
	if err != nil {
		return model.User{}, "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.User{}, "", err
	}
	return user, next, nil
}

func revokeFamily(ctx context.Context, q refreshExec, familyID string, now time.Time) error {
	_, err := q.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = $2 WHERE family_id = $1 AND revoked_at IS NULL`,
		familyID, now.UnixMilli())
	return err
}

// RevokeRefreshFamily revokes every token in the presented token's family.
func (s *Store) RevokeRefreshFamily(raw string) error {
	_, err := s.pool.Exec(context.Background(),
		`UPDATE refresh_tokens SET revoked_at = $2
		  WHERE revoked_at IS NULL
		    AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
		hashRefreshToken(raw), time.Now().UnixMilli())
	return err
}
