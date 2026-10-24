package app

import (
	"bytes"
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"contacts/pkg/model"
)

var (
	pngBytes  = append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
	jpegBytes = append([]byte("\xff\xd8\xff\xe0"), make([]byte, 32)...)
	webpBytes = append([]byte("RIFF\x24\x00\x00\x00WEBPVP8 "), make([]byte, 32)...)
)

func multipartReq(t *testing.T, field string, data []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile(field, "x")
	if err != nil {
		t.Fatal(err)
	}
	fw.Write(data)
	mw.Close()
	req := httptest.NewRequest(http.MethodPut, "/api/contacts/c1/photo", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return req
}

func TestSniffPhotoType(t *testing.T) {
	cases := []struct {
		name string
		data []byte
		want string
	}{
		{"png", pngBytes, "image/png"},
		{"jpeg", jpegBytes, "image/jpeg"},
		{"webp", webpBytes, "image/webp"},
		{"gif", []byte("GIF89a" + strings.Repeat("x", 20)), ""},
		{"text", []byte("hello world"), ""},
		{"html", []byte("<html><body>hi</body></html>"), ""},
		{"empty", nil, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := sniffPhotoType(c.data); got != c.want {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
}

func TestPhotoObjectPath(t *testing.T) {
	if got := photoObjectPath("u1", "cnt_2"); got != "u1/cnt_2" {
		t.Fatalf("got %q", got)
	}
}

func TestReadPhotoUpload(t *testing.T) {
	big := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, maxPhotoBytes)...)
	cases := []struct {
		name       string
		req        *http.Request
		wantStatus int
		wantType   string
	}{
		{"ok png", multipartReq(t, "photo", pngBytes), 0, "image/png"},
		{"ok jpeg", multipartReq(t, "photo", jpegBytes), 0, "image/jpeg"},
		{"wrong field", multipartReq(t, "file", pngBytes), http.StatusBadRequest, ""},
		{"not an image", multipartReq(t, "photo", []byte("just text here")), http.StatusBadRequest, ""},
		{"too large", multipartReq(t, "photo", big), http.StatusRequestEntityTooLarge, ""},
		{"not multipart", httptest.NewRequest(http.MethodPut, "/x", strings.NewReader("raw")), http.StatusBadRequest, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			data, ctype, status, msg := readPhotoUpload(httptest.NewRecorder(), c.req)
			if status != c.wantStatus {
				t.Fatalf("status %d (%s), want %d", status, msg, c.wantStatus)
			}
			if status == 0 && (ctype != c.wantType || len(data) == 0) {
				t.Fatalf("type %q len %d", ctype, len(data))
			}
		})
	}
}

type fakeStorage struct {
	signs atomic.Int32
	fail  string
}

func (f *fakeStorage) Upload(context.Context, string, string, []byte) error { return nil }
func (f *fakeStorage) Delete(context.Context, string) error                 { return nil }
func (f *fakeStorage) SignedURL(_ context.Context, path string, _ time.Duration) (string, error) {
	f.signs.Add(1)
	if path == f.fail {
		return "", errors.New("boom")
	}
	return "https://signed/" + path, nil
}

func TestSignContactsOnlySignsPhotos(t *testing.T) {
	fs := &fakeStorage{fail: "u/bad"}
	a := &App{photos: fs}
	cs := []model.Contact{
		{ContactID: "a"},
		{ContactID: "b", PhotoPath: "u/b"},
		{ContactID: "c"},
		{ContactID: "d", PhotoPath: "u/bad"},
		{ContactID: "e", PhotoPath: "u/e"},
	}
	a.signContactPhotos(context.Background(), cs)
	if fs.signs.Load() != 3 {
		t.Fatalf("signed %d, want 3", fs.signs.Load())
	}
	want := []string{"", "https://signed/u/b", "", "", "https://signed/u/e"}
	for i, c := range cs {
		if c.PhotoURL != want[i] {
			t.Fatalf("contact %s: got %q want %q", c.ContactID, c.PhotoURL, want[i])
		}
	}
}

func TestSignContactsNoStorage(t *testing.T) {
	a := &App{}
	cs := []model.Contact{{ContactID: "b", PhotoPath: "u/b"}}
	a.signContactPhotos(context.Background(), cs)
	if cs[0].PhotoURL != "" {
		t.Fatal("must not sign without storage")
	}
}

func TestPhotoEndpointsUnconfigured(t *testing.T) {
	a := &App{}
	for name, h := range map[string]http.HandlerFunc{"put": a.putPhoto, "delete": a.deletePhoto} {
		rec := httptest.NewRecorder()
		h(rec, httptest.NewRequest(http.MethodPut, "/api/contacts/c1/photo", nil))
		if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "photo storage not configured") {
			t.Fatalf("%s: got %d %s", name, rec.Code, rec.Body.String())
		}
	}
}
