// Package mailer sends transactional email through Resend.
package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const resendURL = "https://api.resend.com/emails"

// Message is a plain email with an HTML and a text body.
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

// Sender delivers a message.
type Sender interface {
	Send(ctx context.Context, m Message) error
}

// Resend is a Sender backed by the Resend HTTP API.
type Resend struct {
	apiKey string
	from   string
	client *http.Client
}

// New returns a Resend sender, or nil when the key or sender address is unset.
func New(apiKey, from string) *Resend {
	if apiKey == "" || from == "" {
		return nil
	}
	return &Resend{apiKey: apiKey, from: from, client: &http.Client{Timeout: 8 * time.Second}}
}

func (r *Resend) Send(ctx context.Context, m Message) error {
	body, err := json.Marshal(map[string]any{
		"from":    r.from,
		"to":      []string{m.To},
		"subject": m.Subject,
		"html":    m.HTML,
		"text":    m.Text,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("resend: status %d: %s", resp.StatusCode, detail)
	}
	return nil
}
