package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// fakeLimiter counts hits per key in memory.
type fakeLimiter struct{ hits map[string]int }

func (f *fakeLimiter) Allow(key string, limit int, _ time.Duration) bool {
	f.hits[key]++
	return f.hits[key] <= limit
}

func TestRateLimitBlocksAuthPathsPerIP(t *testing.T) {
	fl := &fakeLimiter{hits: map[string]int{}}
	a := &App{limiter: fl}
	h := a.rateLimit(2)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	call := func(method, path, ip string) int {
		req := httptest.NewRequest(method, path, nil)
		req.Header.Set("X-Forwarded-For", ip)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}

	for i := 0; i < 2; i++ {
		if code := call(http.MethodPost, "/api/auth/login", "1.1.1.1"); code != http.StatusOK {
			t.Fatalf("request %d: got %d, want 200", i+1, code)
		}
	}
	if code := call(http.MethodPost, "/api/auth/login", "1.1.1.1"); code != http.StatusTooManyRequests {
		t.Fatalf("third request: got %d, want 429", code)
	}
	if code := call(http.MethodPost, "/api/auth/login", "2.2.2.2"); code != http.StatusOK {
		t.Fatalf("other IP: got %d, want 200", code)
	}
	if code := call(http.MethodGet, "/api/contacts", "1.1.1.1"); code != http.StatusOK {
		t.Fatalf("non-auth path: got %d, want 200", code)
	}
	if code := call(http.MethodOptions, "/api/auth/login", "1.1.1.1"); code != http.StatusOK {
		t.Fatalf("preflight: got %d, want 200", code)
	}
}

func TestRateLimitWithoutLimiterAllowsEverything(t *testing.T) {
	a := &App{}
	if !a.allow("ip:1.1.1.1", 0, time.Minute) {
		t.Fatal("a nil limiter must allow")
	}
}
