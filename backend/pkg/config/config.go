package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	JWTSecret    string
	JWT_TTL_Hours int
	DBMaxConns   int32
	DBMinConns   int32
}

func Load(required bool) (Config, error) {
	godotenv.Load()

	cfg := Config{
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		JWT_TTL_Hours: 72,
		DBMaxConns:   10,
		DBMinConns:   2,
	}

	if v := os.Getenv("JWT_TTL_HOURS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.JWT_TTL_Hours = n
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
