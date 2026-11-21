package googleid

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func serve(t *testing.T, status int, body string) *TokenInfo {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("id_token") == "" {
			t.Error("id_token not sent")
		}
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return &TokenInfo{ClientIDs: []string{"app.apps.googleusercontent.com"}, BaseURL: srv.URL, Now: func() time.Time { return time.Unix(1000, 0) }}
}

func goodBody(mod func(m map[string]string)) string {
	m := map[string]string{
		"iss": "https://accounts.google.com", "aud": "app.apps.googleusercontent.com", "sub": "123",
		"email": "Ana@Example.com", "email_verified": "true", "name": "Ana", "exp": strconv.Itoa(2000),
	}
	if mod != nil {
		mod(m)
	}
	out := "{"
	first := true
	for k, v := range m {
		if !first {
			out += ","
		}
		first = false
		out += strconv.Quote(k) + ":" + strconv.Quote(v)
	}
	return out + "}"
}

func TestVerifyAcceptsAGoodToken(t *testing.T) {
	id, err := serve(t, 200, goodBody(nil)).Verify(context.Background(), "tok")
	if err != nil {
		t.Fatal(err)
	}
	if id.Sub != "123" || id.Email != "ana@example.com" || id.Name != "Ana" {
		t.Fatalf("got %+v", id)
	}
}

func TestVerifyRejects(t *testing.T) {
	cases := map[string]struct {
		status int
		mod    func(m map[string]string)
	}{
		"google says 400":      {400, nil},
		"other audience":       {200, func(m map[string]string) { m["aud"] = "other" }},
		"other issuer":         {200, func(m map[string]string) { m["iss"] = "evil.example" }},
		"unverified email":     {200, func(m map[string]string) { m["email_verified"] = "false" }},
		"no email":             {200, func(m map[string]string) { m["email"] = "" }},
		"no subject":           {200, func(m map[string]string) { m["sub"] = "" }},
		"expired":              {200, func(m map[string]string) { m["exp"] = "999" }},
		"expiry is not number": {200, func(m map[string]string) { m["exp"] = "x" }},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := serve(t, c.status, goodBody(c.mod)).Verify(context.Background(), "tok")
			if !errors.Is(err, ErrInvalidToken) {
				t.Fatalf("got %v, want ErrInvalidToken", err)
			}
		})
	}
}

func TestVerifyEmptyTokenAndNoClientIDs(t *testing.T) {
	if _, err := (&TokenInfo{ClientIDs: []string{"a"}}).Verify(context.Background(), ""); !errors.Is(err, ErrInvalidToken) {
		t.Fatal("empty token must be invalid")
	}
	if New([]string{"", "  "}) != nil {
		t.Fatal("no client ids must give no verifier")
	}
	if New([]string{" a ", "b"}) == nil {
		t.Fatal("expected a verifier")
	}
}
