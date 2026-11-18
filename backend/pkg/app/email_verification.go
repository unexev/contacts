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

	"contacts/pkg/auth"
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
	http.Redirect(w, r, a.appURL+"/?email_verified="+result, http.StatusSeeOther)
}

func (a *App) resendVerification(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if a.mailer == nil || a.apiURL == "" || a.appURL == "" {
		errResp(w, http.StatusServiceUnavailable, "email is not configured")
		return
	}
	verified, err := a.store.IsEmailVerified(claims.UserID)
	if err != nil {
		errResp(w, http.StatusNotFound, "user not found")
		return
	}
	if verified {
		errResp(w, http.StatusConflict, "email already verified")
		return
	}
	if !a.allow("verify:"+claims.UserID, 1, verifyResendWindow) {
		tooManyRequests(w, verifyResendWindow)
		return
	}
	user, err := a.store.GetUserByID(claims.UserID)
	if err != nil {
		errResp(w, http.StatusNotFound, "user not found")
		return
	}
	a.sendVerification(user.UserID, user.Email, user.Name)
	dataResp(w, http.StatusAccepted, map[string]string{"status": "sent"})
}
