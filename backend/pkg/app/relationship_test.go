package app

import (
	"database/sql"
	"encoding/json"
	"strings"
	"testing"

	"contacts/pkg/model"
)

func intPtr(i int) *int { return &i }

func TestParseRelationshipStatusFilter(t *testing.T) {
	cases := map[string]string{
		"":             "",
		"single":       "SINGLE",
		" Partnered ":  "PARTNERED",
		"COHABITING":   "COHABITING",
		"none":         "NONE",
		"married":      "",
		"SINGLE; DROP": "",
	}
	for in, want := range cases {
		if got := parseRelationshipStatusFilter(in); got != want {
			t.Errorf("parseRelationshipStatusFilter(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseRelationshipInput(t *testing.T) {
	cases := []struct {
		name         string
		status       *string
		children     *int
		wantStatus   sql.NullString
		wantChildren sql.NullInt64
		wantErr      string
	}{
		{name: "both null", wantStatus: sql.NullString{}, wantChildren: sql.NullInt64{}},
		{name: "empty status is null", status: strPtr("  "), wantStatus: sql.NullString{}},
		{name: "valid values", status: strPtr("cohabiting"), children: intPtr(2),
			wantStatus: sql.NullString{String: "COHABITING", Valid: true}, wantChildren: sql.NullInt64{Int64: 2, Valid: true}},
		{name: "zero children", status: strPtr("SINGLE"), children: intPtr(0),
			wantStatus: sql.NullString{String: "SINGLE", Valid: true}, wantChildren: sql.NullInt64{Int64: 0, Valid: true}},
		{name: "max children", children: intPtr(50), wantChildren: sql.NullInt64{Int64: 50, Valid: true}},
		{name: "invalid status", status: strPtr("MARRIED"), wantErr: "relationship_status"},
		{name: "NONE is not a stored value", status: strPtr("NONE"), wantErr: "relationship_status"},
		{name: "negative children", children: intPtr(-1), wantErr: "children_count"},
		{name: "too many children", children: intPtr(51), wantErr: "children_count"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, children, err := parseRelationshipInput(tc.status, tc.children)
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("err = %v, want mention of %q", err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if status != tc.wantStatus {
				t.Errorf("status = %+v, want %+v", status, tc.wantStatus)
			}
			if children != tc.wantChildren {
				t.Errorf("children = %+v, want %+v", children, tc.wantChildren)
			}
		})
	}
}

func TestContactJSONRelationshipFields(t *testing.T) {
	unknown, err := json.Marshal(model.Contact{ContactID: "c1"})
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(unknown, &got); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"relationship_status", "children_count"} {
		v, ok := got[k]
		if !ok || v != nil {
			t.Errorf("%s = %v (present=%v), want JSON null", k, v, ok)
		}
	}

	known, err := json.Marshal(model.Contact{
		ContactID:          "c2",
		RelationshipStatus: sql.NullString{String: "PARTNERED", Valid: true},
		ChildrenCount:      sql.NullInt64{Int64: 0, Valid: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(known), `"relationship_status":"PARTNERED"`) ||
		!strings.Contains(string(known), `"children_count":0`) {
		t.Errorf("unexpected JSON: %s", known)
	}
}
