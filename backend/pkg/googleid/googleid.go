// Package googleid checks Google ID tokens (the JWT a client gets from Google
// Sign-In) before the backend trusts them to log a user in.
package googleid

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ErrInvalidToken means the token is not a valid, current Google ID token for this app.
var ErrInvalidToken = errors.New("invalid google token")

// Identity is what the backend learns from a valid token.
type Identity struct {
	Sub   string // stable Google account id
	Email string // lowercased
	Name  string
}

// Verifier turns an ID token into an Identity.
type Verifier interface {
	Verify(ctx context.Context, idToken string) (Identity, error)
}

const tokenInfoURL = "https://oauth2.googleapis.com/tokeninfo"

// TokenInfo verifies tokens with Google's tokeninfo endpoint, which checks the
// signature and expiry; this code checks the audience, issuer and email.
type TokenInfo struct {
	// ClientIDs are the OAuth client ids whose tokens are accepted.
	ClientIDs []string
	// BaseURL and HTTP are overridable for tests.
	BaseURL string
	HTTP    *http.Client
	Now     func() time.Time
}

// New returns a verifier for the given client ids, or nil when there are none.
func New(clientIDs []string) *TokenInfo {
	var ids []string
	for _, id := range clientIDs {
		if id = strings.TrimSpace(id); id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return &TokenInfo{ClientIDs: ids}
}

type tokenInfo struct {
	Iss           string `json:"iss"`
	Aud           string `json:"aud"`
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	Exp           string `json:"exp"`
}

func (v *TokenInfo) Verify(ctx context.Context, idToken string) (Identity, error) {
	if idToken == "" {
		return Identity{}, ErrInvalidToken
	}
	base := v.BaseURL
	if base == "" {
		base = tokenInfoURL
	}
	client := v.HTTP
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"?id_token="+url.QueryEscape(idToken), nil)
	if err != nil {
		return Identity{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return Identity{}, fmt.Errorf("google tokeninfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusBadRequest || resp.StatusCode == http.StatusUnauthorized {
		return Identity{}, ErrInvalidToken
	}
	if resp.StatusCode != http.StatusOK {
		return Identity{}, fmt.Errorf("google tokeninfo: status %d", resp.StatusCode)
	}
	var info tokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return Identity{}, fmt.Errorf("google tokeninfo: %w", err)
	}
	return v.check(info)
}

func (v *TokenInfo) check(info tokenInfo) (Identity, error) {
	now := time.Now
	if v.Now != nil {
		now = v.Now
	}
	if info.Iss != "accounts.google.com" && info.Iss != "https://accounts.google.com" {
		return Identity{}, ErrInvalidToken
	}
	allowed := false
	for _, id := range v.ClientIDs {
		if info.Aud == id {
			allowed = true
			break
		}
	}
	if !allowed || info.Sub == "" || info.Email == "" || info.EmailVerified != "true" {
		return Identity{}, ErrInvalidToken
	}
	exp, err := strconv.ParseInt(info.Exp, 10, 64)
	if err != nil || !now().Before(time.Unix(exp, 0)) {
		return Identity{}, ErrInvalidToken
	}
	return Identity{Sub: info.Sub, Email: strings.ToLower(strings.TrimSpace(info.Email)), Name: strings.TrimSpace(info.Name)}, nil
}
