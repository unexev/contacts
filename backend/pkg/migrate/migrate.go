package migrate

import (
	"context"
	"embed"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/001_init.sql migrations/002_locations.sql migrations/003_phone_metadata.sql migrations/004_location_coordinates.sql
var migrations embed.FS

func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	for _, name := range []string{"migrations/001_init.sql", "migrations/002_locations.sql", "migrations/003_phone_metadata.sql", "migrations/004_location_coordinates.sql"} {
		sql, err := migrations.ReadFile(name)
		if err != nil {
			return err
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			return err
		}
	}
	return nil
}
