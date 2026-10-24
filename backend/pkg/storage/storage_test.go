package storage

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func newTestClient(t *testing.T, h http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return New(srv.URL+"/", "service-key", "photos")
}

func TestUpload(t *testing.T) {
	var gotMethod, gotPath, gotAuth, gotType, gotUpsert string
	var gotBody []byte
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		gotAuth, gotType, gotUpsert = r.Header.Get("Authorization"), r.Header.Get("Content-Type"), r.Header.Get("x-upsert")
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	})
	if err := c.Upload(context.Background(), "u1/c1", "image/png", []byte("img")); err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodPost || gotPath != "/storage/v1/object/photos/u1/c1" {
		t.Fatalf("got %s %s", gotMethod, gotPath)
	}
	if gotAuth != "Bearer service-key" || gotType != "image/png" || gotUpsert != "true" || string(gotBody) != "img" {
		t.Fatalf("bad request: auth=%q type=%q upsert=%q body=%q", gotAuth, gotType, gotUpsert, gotBody)
	}
}

func TestUploadError(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"boom"}`, http.StatusInternalServerError)
	})
	err := c.Upload(context.Background(), "u1/c1", "image/png", []byte("x"))
	if err == nil || !strings.Contains(err.Error(), "500") {
		t.Fatalf("expected status error, got %v", err)
	}
}

func TestDelete(t *testing.T) {
	var gotMethod, gotPath string
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		w.WriteHeader(http.StatusOK)
	})
	if err := c.Delete(context.Background(), "u1/c1"); err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodDelete || gotPath != "/storage/v1/object/photos/u1/c1" {
		t.Fatalf("got %s %s", gotMethod, gotPath)
	}
}

func TestDeleteNotFoundIsOK(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"not found"}`, http.StatusNotFound)
	})
	if err := c.Delete(context.Background(), "u1/c1"); err != nil {
		t.Fatalf("404 should be ignored, got %v", err)
	}
}

func TestSignedURL(t *testing.T) {
	var gotMethod, gotPath string
	var body struct {
		ExpiresIn int `json:"expiresIn"`
	}
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		json.NewDecoder(r.Body).Decode(&body)
		w.Write([]byte(`{"signedURL":"/object/sign/photos/u1/c1?token=abc"}`))
	})
	u, err := c.SignedURL(context.Background(), "u1/c1", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if gotMethod != http.MethodPost || gotPath != "/storage/v1/object/sign/photos/u1/c1" || body.ExpiresIn != 3600 {
		t.Fatalf("got %s %s expiresIn=%d", gotMethod, gotPath, body.ExpiresIn)
	}
	if !strings.HasSuffix(u, "/storage/v1/object/sign/photos/u1/c1?token=abc") || !strings.HasPrefix(u, "http") {
		t.Fatalf("bad signed url %q", u)
	}
}

func TestSignedURLMissingField(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{}`)) })
	if _, err := c.SignedURL(context.Background(), "u1/c1", time.Hour); err == nil {
		t.Fatal("expected error")
	}
}

func TestConfigured(t *testing.T) {
	if (New("", "k", "b")).Configured() || (New("u", "", "b")).Configured() || (New("u", "k", "")).Configured() {
		t.Fatal("incomplete config must not be configured")
	}
	if !New("u", "k", "b").Configured() {
		t.Fatal("complete config must be configured")
	}
}
