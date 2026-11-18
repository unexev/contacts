package app

import (
	"context"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"contacts/pkg/mailer"
	"contacts/pkg/store"
)

const (
	verifyTokenTTL = 24 * time.Hour
	// Sending is a paid call to a third party; one per account per 10 minutes.
	verifyResendWindow = 10 * time.Minute
)

// sendVerification issues a token and emails the link. It never fails the
// caller's request: without a configured mailer it does nothing, and a
// delivery error is only logged.
func (a *App) sendVerification(userID, email, name string) {
	if a.mailer == nil || a.apiURL == "" || a.appURL == "" {
		return
	}
	raw, err := a.store.CreateEmailVerification(userID, email, verifyTokenTTL)
	if err != nil {
		log.Printf("create email verification error: %v", err)
		return
	}
	link := a.apiURL + "/api/auth/verify-email?token=" + url.QueryEscape(raw)
	greeting := "Hola"
	if name != "" {
		greeting = "Hola " + name
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	err = a.mailer.Send(ctx, mailer.Message{
		To:      email,
		Subject: "Confirma tu correo",
		Text: fmt.Sprintf("%s,\n\nConfirma tu correo abriendo este enlace (vale 24 horas):\n%s\n\n"+
			"Si no creaste una cuenta, ignora este mensaje.\n", greeting, link),
		HTML: fmt.Sprintf(`<p>%s,</p><p>Confirma tu correo con este enlace (vale 24 horas):</p>`+
			`<p><a href="%s">Confirmar correo</a></p>`+
			`<p>Si no creaste una cuenta, ignora este mensaje.</p>`,
			html.EscapeString(greeting), html.EscapeString(link)),
	})
	if err != nil {
		log.Printf("send verification email error: %v", err)
	}
}

// verifyEmail is opened from the link in the email, so it answers with a
// redirect back to the app instead of JSON.
func (a *App) verifyEmail(w http.ResponseWriter, r *http.Request) {
	err := a.store.VerifyEmail(r.URL.Query().Get("token"))
	result := "ok"
	switch {
	case errors.Is(err, store.ErrInvalidVerificationToken):
		result = "invalid"
	case err != nil:
		log.Printf("verify email error: %v", err)
		result = "error"
	}
	http.Redirect(w, r, a.appURL+"/login?email_verified="+result, http.StatusSeeOther)
}

// resendVerification is public, because an account that must confirm its
// email has no session. The password proves the caller owns the account and
// shares the login attempt budget, so it cannot be used to guess passwords.
func (a *App) resendVerification(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Email == "" || req.Password == "" {
		errResp(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if !a.verificationRequired() {
		errResp(w, http.StatusServiceUnavailable, "email is not configured")
		return
	}
	email := normalizeEmail(req.Email)
	if !a.allow("login:"+email, loginAttemptsPerWindow, loginAttemptsWindow) {
		tooManyRequests(w, loginAttemptsWindow)
		return
	}

	user, hash, err := a.store.GetUserByEmailWithHash(email)
	if errors.Is(err, pgx.ErrNoRows) {
		bcrypt.CompareHashAndPassword(dummyPasswordHash, []byte(req.Password))
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		log.Printf("resend verification error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to resend")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	verified, err := a.store.IsEmailVerified(user.UserID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to resend")
		return
	}
	if verified {
		errResp(w, http.StatusConflict, "email already verified")
		return
	}
	if !a.allow("verify:"+user.UserID, 1, verifyResendWindow) {
		tooManyRequests(w, verifyResendWindow)
		return
	}
	a.sendVerification(user.UserID, user.Email, user.Name)
	dataResp(w, http.StatusAccepted, map[string]string{"status": "sent"})
}
