package main

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, _ := pgxpool.NewWithConfig(ctx, cfg)
	defer pool.Close()

	pool.Exec(ctx, "DELETE FROM contact_bank_accounts")
	pool.Exec(ctx, "DELETE FROM contact_relationships")
	pool.Exec(ctx, "DELETE FROM contact_organizations")
	pool.Exec(ctx, "DELETE FROM identity_cards")
	pool.Exec(ctx, "DELETE FROM contact_urls")
	pool.Exec(ctx, "DELETE FROM contact_notes")
	pool.Exec(ctx, "DELETE FROM contact_keywords")
	pool.Exec(ctx, "DELETE FROM contact_emails")
	pool.Exec(ctx, "DELETE FROM contact_phones")
	pool.Exec(ctx, "DELETE FROM contacts")
	pool.Exec(ctx, "DELETE FROM users")
	fmt.Println("Cleaned all data")
}
