package store

import (
	"encoding/json"
	"testing"
	"time"

	"contacts/pkg/model"
)

func contactRow(id string, deleted bool) SyncRow[model.Contact] {
	return SyncRow[model.Contact]{Row: model.Contact{ContactID: id, FirstName: id}, Deleted: deleted}
}

func sampleChanges() SyncChanges {
	phone := func(contact, id string, deleted bool) SyncRow[SyncPhone] {
		return SyncRow[SyncPhone]{Row: SyncPhone{ContactPhone: model.ContactPhone{ContactID: contact, PhoneID: id}}, Deleted: deleted}
	}
	return SyncChanges{
		Contacts: []SyncRow[model.Contact]{contactRow("a", false), contactRow("b", false), contactRow("gone", true)},
		Phones: []SyncRow[SyncPhone]{
			phone("a", "p1", false),
			phone("a", "p2", true),
			phone("b", "p3", false),
			phone("gone", "p4", false),
		},
		Organizations: []SyncRow[SyncOrganization]{
			{Row: SyncOrganization{Organization: model.Organization{OrganizationID: "o1"}}},
			{Row: SyncOrganization{Organization: model.Organization{OrganizationID: "o2"}}},
			{Row: SyncOrganization{Organization: model.Organization{OrganizationID: "o3"}}, Deleted: true},
		},
		ContactOrgs: []SyncRow[SyncContactOrg]{
			{Row: SyncContactOrg{ContactOrganization: model.ContactOrganization{ContactID: "a", OrganizationID: "o1"}}},
			{Row: SyncContactOrg{ContactOrganization: model.ContactOrganization{ContactID: "b", OrganizationID: "o2"}}},
		},
	}
}

func TestBuildExportFullDropsTombstonesAndOrphans(t *testing.T) {
	e := buildExport(sampleChanges(), nil, time.Unix(0, 0))
	if e.Filtered {
		t.Error("full export must not be marked filtered")
	}
	if len(e.Data.Contacts) != 2 {
		t.Errorf("contacts = %d, want 2", len(e.Data.Contacts))
	}
	// p2 is deleted, p4 belongs to a deleted contact.
	if len(e.Data.Phones) != 2 {
		t.Errorf("phones = %d, want 2", len(e.Data.Phones))
	}
	if len(e.Data.Organizations) != 2 {
		t.Errorf("organizations = %d, want 2 (deleted one dropped)", len(e.Data.Organizations))
	}
}

func TestBuildExportFilteredKeepsOnlySelection(t *testing.T) {
	e := buildExport(sampleChanges(), map[string]bool{"a": true, "gone": true}, time.Unix(0, 0))
	if !e.Filtered {
		t.Error("filtered export must be marked filtered")
	}
	if len(e.Data.Contacts) != 1 || e.Data.Contacts[0].ContactID != "a" {
		t.Fatalf("contacts = %+v, want only a", e.Data.Contacts)
	}
	if len(e.Data.Phones) != 1 || e.Data.Phones[0].PhoneID != "p1" {
		t.Errorf("phones = %+v, want only p1", e.Data.Phones)
	}
	if len(e.Data.Organizations) != 1 || e.Data.Organizations[0].OrganizationID != "o1" {
		t.Errorf("organizations = %+v, want only o1", e.Data.Organizations)
	}
}

func TestBuildExportEmptyArraysNotNull(t *testing.T) {
	e := buildExport(SyncChanges{}, nil, time.Unix(0, 0))
	b, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	var out struct {
		Data map[string]json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Data) != 13 {
		t.Errorf("tables = %d, want 13", len(out.Data))
	}
	for name, raw := range out.Data {
		if string(raw) != "[]" {
			t.Errorf("%s = %s, want []", name, raw)
		}
	}
}
