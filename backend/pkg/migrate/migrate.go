package migrate

import (
	"context"
	_ "embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_init.sql
var initSQL string

func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, initSQL)
	return err
}
