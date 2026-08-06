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

	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS app_users (
			user_id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT DEFAULT '',
			password_hash TEXT NOT NULL,
			role TEXT DEFAULT 'user',
			status TEXT DEFAULT 'active',
			created_at BIGINT DEFAULT 0
		)
	`)
	if err != nil {
		fmt.Printf("Create table error: %v\n", err)
		return
	}
	fmt.Println("Table app_users created")

	// Migrate existing users from our migration
	_, err = pool.Exec(ctx, `
		INSERT INTO app_users (user_id, email, name, password_hash, role, status, created_at)
		SELECT user_id, email, name, password_hash, role, status, created_at
		FROM users
		WHERE user_id LIKE 'usr_%'
		ON CONFLICT (user_id) DO NOTHING
	`)
	if err != nil {
		fmt.Printf("Migrate users error: %v\n", err)
		return
	}
	fmt.Println("Users migrated")

	// Verify
	rows, _ := pool.Query(ctx, "SELECT user_id, email FROM app_users LIMIT 5")
	defer rows.Close()
	fmt.Println("\nApp users:")
	for rows.Next() {
		var uid, email string
		rows.Scan(&uid, &email)
		fmt.Printf("  - %s: %s\n", uid, email)
	}
}
