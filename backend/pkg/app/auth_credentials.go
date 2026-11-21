package app

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"contacts/pkg/auth"
	"contacts/pkg/model"
	"contacts/pkg/store"
)

const (
	minPasswordLen = 8
	// maxPasswordBytes is bcrypt's input limit; longer passwords make
	// GenerateFromPassword fail with ErrPasswordTooLong.
	maxPasswordBytes = 72
)

const (
	// A real user rarely needs more than a few tries; this stops brute force.
	loginAttemptsPerWindow = 10
	loginAttemptsWindow    = 15 * time.Minute
)

// dummyPasswordHash is compared against when the email is unknown.
var dummyPasswordHash, _ = bcrypt.GenerateFromPassword([]byte("unknown-account"), bcrypt.DefaultCost)

// normalizeEmail trims and lowercases, so the same address always maps to one account.
func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validEmail reports whether s is a bare address (no display name).
func validEmail(s string) bool {
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s
}

type registerRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// validateRegister returns an error message ("" when valid). It normalizes the
// email and trims the name in place.
func validateRegister(req *registerRequest) string {
	req.Email = normalizeEmail(req.Email)
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Password == "" {
		return "email and password are required"
	}
	if !validEmail(req.Email) {
		return "invalid email"
	}
	if len(req.Password) < minPasswordLen {
		return "password must be at least 8 characters"
	}
	return validatePasswordLength(req.Password)
}

// validatePasswordLength returns an error message ("" when valid) for a
// password that bcrypt cannot hash.
func validatePasswordLength(password string) string {
	if len(password) > maxPasswordBytes {
		return "password must be at most 72 bytes"
	}
	return ""
}

type credentialsRequest struct {
	CurrentPassword string  `json:"current_password"`
	Email           *string `json:"email"`
	NewPassword     *string `json:"new_password"`
}

// validateCredentialsUpdate returns an error message ("" when valid). It
// normalizes the email in place.
func validateCredentialsUpdate(req *credentialsRequest) string {
	if req.CurrentPassword == "" {
		return "current password is required"
	}
	if req.Email == nil && req.NewPassword == nil {
		return "nothing to update"
	}
	if req.Email != nil {
		email := normalizeEmail(*req.Email)
		if !validEmail(email) {
			return "invalid email"
		}
		req.Email = &email
	}
	if req.NewPassword != nil && len(*req.NewPassword) < minPasswordLen {
		return "password must be at least 8 characters"
	}
	if req.NewPassword != nil {
		return validatePasswordLength(*req.NewPassword)
	}
	return ""
}

func (a *App) updateCredentials(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var req credentialsRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	hash, err := a.store.GetPasswordHashByID(claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		log.Printf("load password hash error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to verify credentials")
		return
	}
	if hash == "" {
		// Accounts created with Google have no password to check or change.
		errResp(w, http.StatusConflict, "this account signs in with Google")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)) != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if msg := validateCredentialsUpdate(&req); msg != "" {
		errResp(w, http.StatusBadRequest, msg)
		return
	}

	newHash := ""
	if req.NewPassword != nil {
		h, err := bcrypt.GenerateFromPassword([]byte(*req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			errResp(w, http.StatusInternalServerError, "failed to hash password")
			return
		}
		newHash = string(h)
	}
	newEmail := ""
	if req.Email != nil {
		newEmail = *req.Email
	}

	refreshToken, err := a.store.UpdateCredentials(claims.UserID, newEmail, newHash, a.refreshTTL)
	if errors.Is(err, store.ErrEmailTaken) {
		errResp(w, http.StatusConflict, "email already in use")
		return
	}
	if err != nil {
		log.Printf("update credentials error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to update credentials")
		return
	}

	user, err := a.store.GetUserByID(claims.UserID)
	if err != nil {
		errResp(w, http.StatusNotFound, "user not found")
		return
	}
	if newEmail != "" && a.verificationRequired() {
		// The new address is unconfirmed, so no session until it is.
		a.sendVerification(user.UserID, user.Email, user.Name)
		dataResp(w, http.StatusOK, model.AuthResponse{User: user, VerificationRequired: true})
		return
	}
	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: refreshToken})
}

const (
	deleteAttemptsPerWindow = 5
	deleteAttemptsWindow    = 15 * time.Minute
)

// deleteAccount permanently removes the account and all its data. It asks for
// the password again, so a stolen access token alone cannot wipe an account.
func (a *App) deleteAccount(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var req struct {
		CurrentPassword string `json:"current_password"`
		// IDToken confirms the deletion for accounts that have no password.
		IDToken string `json:"id_token"`
	}
	if err := decodeJSON(r, &req); err != nil || (req.CurrentPassword == "" && req.IDToken == "") {
		errResp(w, http.StatusBadRequest, "current password is required")
		return
	}
	if !a.allow("delete:"+claims.UserID, deleteAttemptsPerWindow, deleteAttemptsWindow) {
		tooManyRequests(w, deleteAttemptsWindow)
		return
	}

	hash, err := a.store.GetPasswordHashByID(claims.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if err != nil {
		log.Printf("load password hash error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to verify credentials")
		return
	}
	if hash == "" {
		if !a.confirmGoogleOwner(r, claims, req.IDToken) {
			errResp(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
	} else if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)) != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	photos, err := a.store.DeleteAccount(claims.UserID)
	if err != nil {
		log.Printf("delete account error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to delete account")
		return
	}
	// The data is already gone; a photo that fails to delete is only logged.
	if a.photos != nil {
		for _, p := range photos {
			if err := a.photos.Delete(r.Context(), p); err != nil {
				log.Printf("delete photo %q error: %v", p, err)
			}
		}
	}
	w.WriteHeader(http.StatusNoContent)
}
