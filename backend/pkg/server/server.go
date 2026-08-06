package server

import (
	"context"
	"log"
	"net/http"
	"strings"
	"sync"

	"contacts/pkg/app"
	"contacts/pkg/auth"
	"contacts/pkg/config"
	"contacts/pkg/migrate"
	"contacts/pkg/store"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	once    sync.Once
	handler http.Handler
	initErr error
)

func Handler() (http.Handler, error) {
	once.Do(func() {
		cfg, err := config.Load(true)
		if err != nil {
			initErr = err
			return
		}

		ctx := context.Background()

		pgxCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
		if err != nil {
			initErr = err
			return
		}

		// Supabase Transaction Pooler requires simple protocol
		if strings.Contains(cfg.DatabaseURL, "pgbouncer=true") || strings.Contains(cfg.DatabaseURL, "pooler.supabase.com") {
			pgxCfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
		}

		if cfg.DBMaxConns > 0 {
			pgxCfg.MaxConns = cfg.DBMaxConns
		}
		if cfg.DBMinConns > 0 {
			pgxCfg.MinConns = cfg.DBMinConns
		}

		pool, err := pgxpool.NewWithConfig(ctx, pgxCfg)
		if err != nil {
			initErr = err
			return
		}

		if err := migrate.Apply(ctx, pool); err != nil {
			pool.Close()
			initErr = err
			return
		}

		s := store.New(pool)
		authMgr := auth.NewManager(cfg.JWTSecret, cfg.JWT_TTL_Hours)
		a := app.New(s, authMgr)

		handler = a.Handler()
	})
	return handler, initErr
}

func HandlerOrFatal() http.Handler {
	h, err := Handler()
	if err != nil {
		log.Fatalf("failed to initialize server: %v", err)
	}
	return h
}
