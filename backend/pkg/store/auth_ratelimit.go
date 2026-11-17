package store

import (
	"context"
	"time"
)

// rateLimitPurgeAfter is how long a counter row outlives its window.
const rateLimitPurgeAfter = 24 * time.Hour

// HitRateLimit counts one event for key in the current fixed window and
// returns the total for that window, shared by every server instance.
func (s *Store) HitRateLimit(key string, window time.Duration) (int, error) {
	ctx := context.Background()
	now := time.Now()
	windowMs := window.Milliseconds()
	start := now.UnixMilli() / windowMs * windowMs

	var count int
	err := s.pool.QueryRow(ctx,
		`INSERT INTO auth_rate_limits (key, window_start, count) VALUES ($1, $2, 1)
		 ON CONFLICT (key) DO UPDATE SET
		     count = CASE WHEN auth_rate_limits.window_start = EXCLUDED.window_start
		                  THEN auth_rate_limits.count + 1 ELSE 1 END,
		     window_start = EXCLUDED.window_start
		 RETURNING count`,
		key, start).Scan(&count)
	if err != nil {
		return 0, err
	}

	// A key entering a fresh window is a cheap moment to drop stale rows.
	if count == 1 {
		_, _ = s.pool.Exec(ctx,
			`DELETE FROM auth_rate_limits WHERE window_start < $1`,
			now.Add(-rateLimitPurgeAfter).UnixMilli())
	}
	return count, nil
}
