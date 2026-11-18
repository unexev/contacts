package app

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"contacts/pkg/auth"
	"contacts/pkg/store"
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
				w.Header().Set("Access-Control-Allow-Credentials", "true")
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

// ── Rate limiting ─────────────────────────────────────────────────────────────

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

// rateLimiter counts one event for key and reports whether it is still within
// limit for the current window.
type rateLimiter interface {
	Allow(key string, limit int, window time.Duration) bool
}

// storeLimiter keeps the counters in Postgres so every instance shares them.
// It fails open: a database hiccup must not lock everyone out of auth.
type storeLimiter struct{ store *store.Store }

func (l storeLimiter) Allow(key string, limit int, window time.Duration) bool {
	count, err := l.store.HitRateLimit(key, window)
	if err != nil {
		log.Printf("rate limit error: %v", err)
		return true
	}
	return count <= limit
}

// allow is the nil-safe entry point; without a limiter nothing is limited.
func (a *App) allow(key string, limit int, window time.Duration) bool {
	return a.limiter == nil || a.limiter.Allow(key, limit, window)
}

func tooManyRequests(w http.ResponseWriter, window time.Duration) {
	w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
	errResp(w, http.StatusTooManyRequests, "too many requests")
}

// rateLimit caps the requests each IP may send to /api/auth/* per minute.
func (a *App) rateLimit(perMin int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodOptions && strings.HasPrefix(r.URL.Path, "/api/auth/") &&
				!a.allow("ip:"+clientIP(r), perMin, time.Minute) {
				tooManyRequests(w, time.Minute)
				return
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
	var out []string
	for _, o := range strings.Split(v, ",") {
		out = append(out, strings.TrimRight(strings.TrimSpace(o), "/"))
	}
	return out
}

type verifiedKey struct{}

// verificationRequired reports whether email confirmation is enforced. It is
// only possible when email delivery is configured, so a missing Resend setup
// can never lock everyone out.
func (a *App) verificationRequired() bool {
	return a.mailer != nil && a.apiURL != "" && a.appURL != ""
}

// requireUser rejects a valid token whose account no longer exists. Access
// tokens are stateless, so without this a deleted account's token would keep
// working, and could even create orphan rows, until it expires.
func (a *App) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := auth.GetUser(r)
		if claims == nil {
			errResp(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		state := a.userState
		if state == nil {
			state = a.store.UserState
		}
		exists, verified, err := state(claims.UserID)
		if err != nil {
			log.Printf("check user error: %v", err)
			errResp(w, http.StatusInternalServerError, "failed to verify session")
			return
		}
		if !exists {
			errResp(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), verifiedKey{}, verified)))
	})
}

// requireVerified blocks accounts whose email is not confirmed yet. It runs
// after requireUser, and the few routes a locked account still needs (read,
// fix or delete the account) sit outside it.
func (a *App) requireVerified(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if verified, _ := r.Context().Value(verifiedKey{}).(bool); !verified && a.verificationRequired() {
			errResp(w, http.StatusForbidden, "email not verified")
			return
		}
		next.ServeHTTP(w, r)
	})
}
