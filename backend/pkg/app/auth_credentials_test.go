package app

import (
	"strings"
	"testing"
)

func TestValidateCredentialsUpdate(t *testing.T) {
	cases := []struct {
		name    string
		req     credentialsRequest
		wantMsg string
	}{
		{"no changes", credentialsRequest{CurrentPassword: "oldpassword"}, "nothing to update"},
		{"empty email pointer", credentialsRequest{CurrentPassword: "x", Email: strPtr("  ")}, "invalid email"},
		{"bad email", credentialsRequest{CurrentPassword: "x", Email: strPtr("not-an-email")}, "invalid email"},
		{"display-name email", credentialsRequest{CurrentPassword: "x", Email: strPtr("A <a@b.com>")}, "invalid email"},
		{"short password", credentialsRequest{CurrentPassword: "x", NewPassword: strPtr("short")}, "password must be at least 8 characters"},
		{"too long password", credentialsRequest{CurrentPassword: "x", NewPassword: strPtr(strings.Repeat("a", 73))}, "password must be at most 72 bytes"},
		{"max length password", credentialsRequest{CurrentPassword: "x", NewPassword: strPtr(strings.Repeat("a", 72))}, ""},
		{"multibyte over limit", credentialsRequest{CurrentPassword: "x", NewPassword: strPtr(strings.Repeat("é", 37))}, "password must be at most 72 bytes"},
		{"missing current", credentialsRequest{Email: strPtr("a@b.com")}, "current password is required"},
		{"email ok", credentialsRequest{CurrentPassword: "x", Email: strPtr(" a@b.com ")}, ""},
		{"password ok", credentialsRequest{CurrentPassword: "x", NewPassword: strPtr("longenough")}, ""},
		{"both ok", credentialsRequest{CurrentPassword: "x", Email: strPtr("a@b.com"), NewPassword: strPtr("longenough")}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := validateCredentialsUpdate(&c.req); got != c.wantMsg {
				t.Fatalf("got %q, want %q", got, c.wantMsg)
			}
		})
	}
}

func TestValidateCredentialsUpdateTrimsEmail(t *testing.T) {
	req := credentialsRequest{CurrentPassword: "x", Email: strPtr(" a@b.com ")}
	if msg := validateCredentialsUpdate(&req); msg != "" || *req.Email != "a@b.com" {
		t.Fatalf("msg=%q email=%q", msg, *req.Email)
	}
}

func strPtr(s string) *string { return &s }

func TestValidatePasswordLength(t *testing.T) {
	if msg := validatePasswordLength(strings.Repeat("a", 72)); msg != "" {
		t.Fatalf("72 bytes should be valid, got %q", msg)
	}
	if msg := validatePasswordLength(strings.Repeat("a", 73)); msg == "" {
		t.Fatal("73 bytes should be rejected")
	}
}

func TestValidateRegister(t *testing.T) {
	cases := []struct {
		name    string
		req     registerRequest
		wantMsg string
	}{
		{"missing email", registerRequest{Password: "longenough"}, "email and password are required"},
		{"missing password", registerRequest{Email: "a@b.com"}, "email and password are required"},
		{"bad email", registerRequest{Email: "not-an-email", Password: "longenough"}, "invalid email"},
		{"display-name email", registerRequest{Email: "A <a@b.com>", Password: "longenough"}, "invalid email"},
		{"short password", registerRequest{Email: "a@b.com", Password: "short"}, "password must be at least 8 characters"},
		{"too long password", registerRequest{Email: "a@b.com", Password: strings.Repeat("a", 73)}, "password must be at most 72 bytes"},
		{"ok", registerRequest{Email: "a@b.com", Password: "longenough"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := validateRegister(&c.req); got != c.wantMsg {
				t.Fatalf("got %q, want %q", got, c.wantMsg)
			}
		})
	}
}

func TestValidateRegisterNormalizes(t *testing.T) {
	req := registerRequest{Email: "  Ana@Example.COM ", Name: " Ana ", Password: "longenough"}
	if msg := validateRegister(&req); msg != "" || req.Email != "ana@example.com" || req.Name != "Ana" {
		t.Fatalf("msg=%q email=%q name=%q", msg, req.Email, req.Name)
	}
}
