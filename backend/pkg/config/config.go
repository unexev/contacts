package config

import (
	"fmt"
	"os"
	"strconv"

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
