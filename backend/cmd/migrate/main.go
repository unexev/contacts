package main

import (
	"context"
	"log"

	"contacts/pkg/config"
	"contacts/pkg/migrate"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cfg, err := config.Load(true)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx := context.Background()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to create connection pool: %v", err)
	}
	defer pool.Close()

	if err := migrate.Apply(ctx, pool); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	log.Println("migrations applied successfully")
}
