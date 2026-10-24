// Package storage is a minimal Supabase Storage REST client (no SDK).
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Store is what the app layer needs from object storage; fake it in tests.
type Store interface {
	Upload(ctx context.Context, path, contentType string, data []byte) error
	Delete(ctx context.Context, path string) error
	SignedURL(ctx context.Context, path string, ttl time.Duration) (string, error)
}

type Client struct {
	baseURL    string
	serviceKey string
	bucket     string
	http       *http.Client
}

var _ Store = (*Client)(nil)

func New(baseURL, serviceKey, bucket string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		serviceKey: serviceKey,
		bucket:     bucket,
		http:       &http.Client{Timeout: 15 * time.Second},
	}
}

// Configured reports whether all connection settings are present.
func (c *Client) Configured() bool {
	return c.baseURL != "" && c.serviceKey != "" && c.bucket != ""
}

// objectURL builds {base}/storage/v1/{prefix}/{bucket}/{path}, escaping each path segment.
func (c *Client) objectURL(prefix, path string) string {
	segs := strings.Split(path, "/")
	for i, s := range segs {
		segs[i] = url.PathEscape(s)
	}
	u := c.baseURL + "/storage/v1/object/"
	if prefix != "" {
		u += prefix + "/"
	}
	return u + url.PathEscape(c.bucket) + "/" + strings.Join(segs, "/")
}

func (c *Client) do(ctx context.Context, method, u, contentType string, body []byte, extra map[string]string) ([]byte, int, error) {
	req, err := http.NewRequestWithContext(ctx, method, u, bytes.NewReader(body))
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	for k, v := range extra {
		req.Header.Set(k, v)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	return data, resp.StatusCode, err
}

func statusErr(op string, status int, body []byte) error {
	msg := strings.TrimSpace(string(body))
	if len(msg) > 200 {
		msg = msg[:200]
	}
	return fmt.Errorf("storage %s: status %d: %s", op, status, msg)
}

// Upload stores data at path, replacing any existing object.
func (c *Client) Upload(ctx context.Context, path, contentType string, data []byte) error {
	body, status, err := c.do(ctx, http.MethodPost, c.objectURL("", path), contentType, data,
		map[string]string{"x-upsert": "true"})
	if err != nil {
		return fmt.Errorf("storage upload: %w", err)
	}
	if status < 200 || status > 299 {
		return statusErr("upload", status, body)
	}
	return nil
}

// Delete removes the object at path; a missing object is not an error.
func (c *Client) Delete(ctx context.Context, path string) error {
	body, status, err := c.do(ctx, http.MethodDelete, c.objectURL("", path), "", nil, nil)
	if err != nil {
		return fmt.Errorf("storage delete: %w", err)
	}
	if status == http.StatusNotFound {
		return nil
	}
	if status < 200 || status > 299 {
		return statusErr("delete", status, body)
	}
	return nil
}

// SignedURL returns an absolute, time-limited URL for reading the private object at path.
func (c *Client) SignedURL(ctx context.Context, path string, ttl time.Duration) (string, error) {
	payload, _ := json.Marshal(map[string]int{"expiresIn": int(ttl.Seconds())})
	body, status, err := c.do(ctx, http.MethodPost, c.objectURL("sign", path), "application/json", payload, nil)
	if err != nil {
		return "", fmt.Errorf("storage sign: %w", err)
	}
	if status < 200 || status > 299 {
		return "", statusErr("sign", status, body)
	}
	var out struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.Unmarshal(body, &out); err != nil || out.SignedURL == "" {
		return "", fmt.Errorf("storage sign: unexpected response")
	}
	if strings.HasPrefix(out.SignedURL, "http") {
		return out.SignedURL, nil
	}
	return c.baseURL + "/storage/v1" + out.SignedURL, nil
}
