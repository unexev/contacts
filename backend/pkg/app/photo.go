package app

import (
	"context"
	"errors"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"contacts/pkg/auth"
	"contacts/pkg/model"
	"contacts/pkg/storage"

	"github.com/go-chi/chi/v5"
)

const (
	maxPhotoBytes = 2 << 20
	// Room for multipart framing on top of the photo itself.
	maxPhotoRequestBytes = maxPhotoBytes + 64<<10
	photoURLTTL          = time.Hour
	photoSignConcurrency = 8
	photoSignTimeout     = 10 * time.Second
)

var errPhotoNotConfigured = "photo storage not configured"

// WithStorage sets the object storage used for contact photos.
func WithStorage(s storage.Store) Option {
	return func(a *App) { a.photos = s }
}

func photoObjectPath(userID, contactID string) string {
	return userID + "/" + contactID
}

// sniffPhotoType returns the detected MIME type when data is a supported image, else "".
func sniffPhotoType(data []byte) string {
	switch t := http.DetectContentType(data); t {
	case "image/jpeg", "image/png", "image/webp":
		return t
	}
	return ""
}

// readPhotoUpload reads the "photo" multipart field. On failure it returns a non-zero HTTP status and message.
func readPhotoUpload(w http.ResponseWriter, r *http.Request) (data []byte, contentType string, status int, msg string) {
	r.Body = http.MaxBytesReader(w, r.Body, maxPhotoRequestBytes)
	mr, err := r.MultipartReader()
	if err != nil {
		return nil, "", http.StatusBadRequest, "expected multipart form data"
	}
	for {
		part, err := mr.NextPart()
		if err == io.EOF {
			return nil, "", http.StatusBadRequest, "missing photo field"
		}
		if err != nil {
			st, m := readErrStatus(err)
			return nil, "", st, m
		}
		if part.FormName() != "photo" {
			continue
		}
		data, err = io.ReadAll(io.LimitReader(part, maxPhotoBytes+1))
		if err != nil {
			st, m := readErrStatus(err)
			return nil, "", st, m
		}
		if len(data) > maxPhotoBytes {
			return nil, "", http.StatusRequestEntityTooLarge, "photo must be at most 2 MB"
		}
		ct := sniffPhotoType(data)
		if ct == "" {
			return nil, "", http.StatusBadRequest, "photo must be a JPEG, PNG or WebP image"
		}
		return data, ct, 0, ""
	}
}

func readErrStatus(err error) (int, string) {
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) {
		return http.StatusRequestEntityTooLarge, "photo must be at most 2 MB"
	}
	return http.StatusBadRequest, "invalid upload"
}

// signContactPhotos fills PhotoURL for contacts that have a photo. Signing is
// a network call, so it only runs for those contacts, a few at a time.
// Failures are logged and leave the contact without a photo_url.
func (a *App) signContactPhotos(ctx context.Context, contacts []model.Contact) {
	if a.photos == nil {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, photoSignTimeout)
	defer cancel()

	sem := make(chan struct{}, photoSignConcurrency)
	var wg sync.WaitGroup
	for i := range contacts {
		if contacts[i].PhotoPath == "" {
			continue
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(c *model.Contact) {
			defer wg.Done()
			defer func() { <-sem }()
			u, err := a.photos.SignedURL(ctx, c.PhotoPath, photoURLTTL)
			if err != nil {
				log.Printf("sign photo error: contact=%s err=%v", c.ContactID, err)
				return
			}
			c.PhotoURL = u
		}(&contacts[i])
	}
	wg.Wait()
}

func (a *App) putPhoto(w http.ResponseWriter, r *http.Request) {
	if a.photos == nil {
		errResp(w, http.StatusServiceUnavailable, errPhotoNotConfigured)
		return
	}
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	if _, err := a.store.GetContact(claims.UserID, contactID); err != nil {
		errResp(w, http.StatusNotFound, "contact not found")
		return
	}
	data, ctype, status, msg := readPhotoUpload(w, r)
	if status != 0 {
		errResp(w, status, msg)
		return
	}

	path := photoObjectPath(claims.UserID, contactID)
	if err := a.photos.Upload(r.Context(), path, ctype, data); err != nil {
		log.Printf("putPhoto upload error: user=%s contact=%s err=%v", claims.UserID, contactID, err)
		errResp(w, http.StatusBadGateway, "failed to store photo")
		return
	}
	if err := a.store.SetContactPhotoPath(claims.UserID, contactID, path); err != nil {
		log.Printf("putPhoto db error: user=%s contact=%s err=%v", claims.UserID, contactID, err)
		errResp(w, http.StatusInternalServerError, "failed to save photo")
		return
	}

	resp := map[string]string{}
	if u, err := a.photos.SignedURL(r.Context(), path, photoURLTTL); err != nil {
		log.Printf("putPhoto sign error: user=%s contact=%s err=%v", claims.UserID, contactID, err)
	} else {
		resp["photo_url"] = u
	}
	dataResp(w, http.StatusOK, resp)
}

func (a *App) deletePhoto(w http.ResponseWriter, r *http.Request) {
	if a.photos == nil {
		errResp(w, http.StatusServiceUnavailable, errPhotoNotConfigured)
		return
	}
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	c, err := a.store.GetContact(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusNotFound, "contact not found")
		return
	}
	if c.PhotoPath != "" {
		if err := a.photos.Delete(r.Context(), c.PhotoPath); err != nil {
			log.Printf("deletePhoto storage error: user=%s contact=%s err=%v", claims.UserID, contactID, err)
			errResp(w, http.StatusBadGateway, "failed to delete photo")
			return
		}
	}
	if err := a.store.SetContactPhotoPath(claims.UserID, contactID, ""); err != nil {
		log.Printf("deletePhoto db error: user=%s contact=%s err=%v", claims.UserID, contactID, err)
		errResp(w, http.StatusInternalServerError, "failed to remove photo")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}
