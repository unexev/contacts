package app

import (
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// CORS permite los orígenes configurados (o todos si "*").
// Lee CORS_ORIGINS de env en cada request para soportar cold starts de Vercel.
func CORS() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				origins := getCORSOrigins()
				allowAll := false
				set := map[string]bool{}
				for _, o := range origins {
					o = strings.TrimSpace(o)
					if o == "*" {
						allowAll = true
					}
					set[o] = true
				}

				allowed := allowAll || set[origin]
				if allowed {
					if allowAll {
						w.Header().Set("Access-Control-Allow-Origin", "*")
					} else {
						w.Header().Set("Access-Control-Allow-Origin", origin)
						w.Header().Set("Vary", "Origin")
					}
				}
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// securityHeaders agrega encabezados mínimos de seguridad.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			w.Header().Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
		}
		next.ServeHTTP(w, r)
	})
}

// ── Rate limiting por IP ──────────────────────────────────────────────────────

type ipLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	rate     int
	interval time.Duration
}

type bucket struct {
	tokens  int
	updated time.Time
}

func newIPLimiter(perMin int) *ipLimiter {
	il := &ipLimiter{
		buckets:  map[string]*bucket{},
		rate:     perMin,
		interval: time.Minute,
	}
	go il.gc()
	return il
}

func (l *ipLimiter) gc() {
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for range t.C {
		l.mu.Lock()
		cutoff := time.Now().Add(-10 * time.Minute)
		for k, b := range l.buckets {
			if b.updated.Before(cutoff) {
				delete(l.buckets, k)
			}
		}
		l.mu.Unlock()
	}
}

func (l *ipLimiter) allow(ip string) bool {
	if l.rate <= 0 {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b, ok := l.buckets[ip]
	if !ok {
		l.buckets[ip] = &bucket{tokens: l.rate - 1, updated: now}
		return true
	}
	elapsed := now.Sub(b.updated)
	refill := int(elapsed / l.interval) * l.rate
	if refill > 0 {
		b.tokens = min(l.rate, b.tokens+refill)
		b.updated = now
	}
	if b.tokens <= 0 {
		return false
	}
	b.tokens--
	return true
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func clientIP(r *http.Request) string {
	if h := r.Header.Get("X-Forwarded-For"); h != "" {
		parts := strings.Split(h, ",")
		return strings.TrimSpace(parts[0])
	}
	if h := r.Header.Get("X-Real-IP"); h != "" {
		return strings.TrimSpace(h)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func rateLimit(perMin int) func(http.Handler) http.Handler {
	if perMin <= 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	lim := newIPLimiter(perMin)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/auth/") {
				ip := clientIP(r)
				if !lim.allow(ip) {
					w.Header().Set("Retry-After", "60")
					errResp(w, http.StatusTooManyRequests, "too many requests")
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

func getCORSOrigins() []string {
	v := os.Getenv("CORS_ORIGINS")
	if v == "" {
		v = "http://localhost:5173,http://localhost:4173"
	}
	return strings.Split(v, ",")
}
