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

	tables := []string{"contacts", "contact_phones", "contact_emails", "contact_urls", "contact_notes", "contact_keywords", "identity_cards", "contact_bank_accounts", "contact_relationships", "contact_organizations"}
	for _, t := range tables {
		rows, _ := pool.Query(ctx, fmt.Sprintf(`
			SELECT column_name, data_type
			FROM information_schema.columns
			WHERE table_name = '%s'
			ORDER BY ordinal_position
		`, t))
		defer rows.Close()
		fmt.Printf("\n%s:\n", t)
		for rows.Next() {
			var name, dtype string
			rows.Scan(&name, &dtype)
			fmt.Printf("  - %s: %s\n", name, dtype)
		}
	}
}
