package app

import (
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"

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

// validateCredentialsUpdate returns an error message ("" when valid). It trims
// the email in place.
func validateCredentialsUpdate(req *credentialsRequest) string {
	if req.CurrentPassword == "" {
		return "current password is required"
	}
	if req.Email == nil && req.NewPassword == nil {
		return "nothing to update"
	}
	if req.Email != nil {
		trimmed := strings.TrimSpace(*req.Email)
		addr, err := mail.ParseAddress(trimmed)
		if err != nil || addr.Address != trimmed {
			return "invalid email"
		}
		req.Email = &trimmed
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
	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}
	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: refreshToken})
}
