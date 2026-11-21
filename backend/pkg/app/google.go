package app

import (
	"errors"
	"log"
	"net/http"

	"contacts/pkg/auth"
	"contacts/pkg/googleid"
	"contacts/pkg/model"
	"contacts/pkg/store"
)

// googleLogin signs a user in with a Google ID token. The account is matched
// by Google id or, failing that, by the verified email (see Store.LoginWithGoogle).
func (a *App) googleLogin(w http.ResponseWriter, r *http.Request) {
	if a.google == nil {
		errResp(w, http.StatusServiceUnavailable, "google sign-in is not configured")
		return
	}
	var req struct {
		IDToken string `json:"id_token"`
	}
	if err := decodeJSON(r, &req); err != nil || req.IDToken == "" {
		errResp(w, http.StatusBadRequest, "id_token is required")
		return
	}

	id, err := a.google.Verify(r.Context(), req.IDToken)
	if errors.Is(err, googleid.ErrInvalidToken) {
		errResp(w, http.StatusUnauthorized, "invalid google token")
		return
	}
	if err != nil {
		log.Printf("google verify error: %v", err)
		errResp(w, http.StatusBadGateway, "could not verify the google token")
		return
	}

	user, err := a.store.LoginWithGoogle(id.Sub, id.Email, id.Name)
	if errors.Is(err, store.ErrGoogleConflict) {
		errResp(w, http.StatusConflict, "email belongs to another google account")
		return
	}
	if err != nil {
		log.Printf("google login error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to log in")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	refreshToken, err := a.store.IssueRefreshToken(user.UserID, a.refreshTTL)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to issue refresh token")
		return
	}
	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: refreshToken})
}

// confirmGoogleOwner reports whether idToken is a valid token of the Google
// account linked to the user. Accounts without a password use it to confirm
// destructive actions.
func (a *App) confirmGoogleOwner(r *http.Request, claims *auth.Claims, idToken string) bool {
	if a.google == nil || idToken == "" {
		return false
	}
	id, err := a.google.Verify(r.Context(), idToken)
	if err != nil {
		return false
	}
	sub, err := a.store.GoogleSubByID(claims.UserID)
	return err == nil && sub != "" && sub == id.Sub
}
