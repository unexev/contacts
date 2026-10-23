package app

import (
	"errors"
	"log"
	"net/http"

	"contacts/pkg/model"
	"contacts/pkg/store"
)

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (a *App) refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, next, err := a.store.RotateRefreshToken(req.RefreshToken, a.refreshTTL, a.refreshGrace)
	if errors.Is(err, store.ErrInvalidRefreshToken) {
		errResp(w, http.StatusUnauthorized, "invalid refresh token")
		return
	}
	if err != nil {
		log.Printf("refresh error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to refresh token")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user, RefreshToken: next})
}

func (a *App) logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := a.store.RevokeRefreshFamily(req.RefreshToken); err != nil {
		log.Printf("logout error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to log out")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
