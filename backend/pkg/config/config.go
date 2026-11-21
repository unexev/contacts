package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	JWTSecret   string
	// JWTTTLMinutes is the access token lifetime; clients renew it with the
	// refresh token, so it stays short.
	JWTTTLMinutes       int
	RefreshTTLDays      int
	RefreshGraceSeconds int
	DBMaxConns          int32
	DBMinConns          int32

	// Supabase Storage for contact photos; photo endpoints answer 503 when unset.
	SupabaseURL        string
	SupabaseServiceKey string
	SupabaseBucket     string

	// Resend sends the verification email; without ResendAPIKey registration
	// still works and the email is skipped. APIURL is the public base URL of
	// this backend (the link in the email points at it); AppURL is the public
	// URL of the web app, where the link redirects afterwards.
	ResendAPIKey string
	EmailFrom    string
	APIURL       string
	AppURL       string

	// GoogleClientIDs are the OAuth client ids whose Google ID tokens the
	// backend accepts for sign-in (comma separated in GOOGLE_CLIENT_IDS);
	// without any, /api/auth/google answers 503.
	GoogleClientIDs []string
}

func Load(required bool) (Config, error) {
	godotenv.Load()

	cfg := Config{
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		JWTTTLMinutes:       60,
		RefreshTTLDays:      90,
		RefreshGraceSeconds: 300,
		DBMaxConns:          3,
		DBMinConns:          0,
		SupabaseURL:         os.Getenv("SUPABASE_URL"),
		SupabaseServiceKey:  os.Getenv("SUPABASE_SERVICE_KEY"),
		SupabaseBucket:      os.Getenv("SUPABASE_BUCKET"),
		ResendAPIKey:        os.Getenv("RESEND_API_KEY"),
		EmailFrom:           os.Getenv("EMAIL_FROM"),
		APIURL:              strings.TrimRight(os.Getenv("API_URL"), "/"),
		AppURL:              strings.TrimRight(os.Getenv("APP_URL"), "/"),
		GoogleClientIDs:     strings.Split(os.Getenv("GOOGLE_CLIENT_IDS"), ","),
	}

	if v := os.Getenv("JWT_TTL_MINUTES"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.JWTTTLMinutes = n
		}
	}
	if v := os.Getenv("REFRESH_TTL_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.RefreshTTLDays = n
		}
	}
	if v := os.Getenv("REFRESH_GRACE_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			cfg.RefreshGraceSeconds = n
		}
	}

	if required && cfg.DatabaseURL == "" {
		return cfg, ErrMissingDatabaseURL
	}
	if required && cfg.JWTSecret == "" {
		return cfg, ErrMissingJWTSecret
	}

	return cfg, nil
}

var (
	ErrMissingDatabaseURL = fmt.Errorf("DATABASE_URL is required")
	ErrMissingJWTSecret   = fmt.Errorf("JWT_SECRET is required")
)
