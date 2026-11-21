package app

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"contacts/pkg/googleid"
)

type fakeVerifier struct {
	id  googleid.Identity
	err error
}

func (f fakeVerifier) Verify(context.Context, string) (googleid.Identity, error) { return f.id, f.err }

func postGoogle(a *App, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/auth/google", bytes.NewBufferString(body))
	rec := httptest.NewRecorder()
	a.Handler().ServeHTTP(rec, req)
	return rec
}

func TestGoogleLoginWithoutConfiguration(t *testing.T) {
	a := &App{}
	if rec := postGoogle(a, `{"id_token":"x"}`); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d, want 503", rec.Code)
	}
}

func TestGoogleLoginRejectsBadRequests(t *testing.T) {
	a := &App{google: fakeVerifier{err: googleid.ErrInvalidToken}}
	if rec := postGoogle(a, `{}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("missing token: got %d, want 400", rec.Code)
	}
	if rec := postGoogle(a, `not json`); rec.Code != http.StatusBadRequest {
		t.Fatalf("bad body: got %d, want 400", rec.Code)
	}
	if rec := postGoogle(a, `{"id_token":"forged"}`); rec.Code != http.StatusUnauthorized {
		t.Fatalf("invalid token: got %d, want 401", rec.Code)
	}
}

func TestConfirmGoogleOwnerNeedsAVerifierAndAToken(t *testing.T) {
	if (&App{}).confirmGoogleOwner(nil, nil, "tok") {
		t.Fatal("no verifier must not confirm")
	}
	if (&App{google: fakeVerifier{}}).confirmGoogleOwner(nil, nil, "") {
		t.Fatal("empty token must not confirm")
	}
}
