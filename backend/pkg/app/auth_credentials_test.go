package app

import "testing"

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
