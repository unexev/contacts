package app

import (
	"encoding/json"
	"testing"
)

func TestParseRelationshipDelete(t *testing.T) {
	cases := []struct {
		name        string
		change      pushChange
		wantRelated string
		wantType    string
		wantErr     bool
	}{
		{name: "with type", change: pushChange{ContactID: "c1", ID: "c2", Data: json.RawMessage(`{"type_id":"hermano"}`)}, wantRelated: "c2", wantType: "hermano"},
		{name: "without data removes every type", change: pushChange{ContactID: "c1", ID: "c2"}, wantRelated: "c2"},
		{name: "null data", change: pushChange{ContactID: "c1", ID: "c2", Data: json.RawMessage(`null`)}, wantRelated: "c2"},
		{name: "missing contact", change: pushChange{ID: "c2"}, wantErr: true},
		{name: "missing related contact", change: pushChange{ContactID: "c1"}, wantErr: true},
		{name: "bad data", change: pushChange{ContactID: "c1", ID: "c2", Data: json.RawMessage(`[1]`)}, wantErr: true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			related, typeID, err := parseRelationshipDelete(tc.change)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
			if related != tc.wantRelated || typeID != tc.wantType {
				t.Errorf("got (%q, %q), want (%q, %q)", related, typeID, tc.wantRelated, tc.wantType)
			}
		})
	}
}
