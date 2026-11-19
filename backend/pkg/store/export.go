package store

import (
	"time"

	"contacts/pkg/model"
)

// ExportFormat and ExportVersion identify the export document so a future
// importer can tell what it is reading.
const (
	ExportFormat  = "contacts-export"
	ExportVersion = 1
)

// ExportData holds one array per table, with the same column names as the
// schema, so each array can be loaded back with jsonb_populate_recordset.
type ExportData struct {
	Contacts      []model.Contact     `json:"contacts"`
	Phones        []SyncPhone         `json:"phones"`
	Emails        []SyncEmail         `json:"emails"`
	Urls          []SyncUrl           `json:"urls"`
	Notes         []model.ContactNote `json:"notes"`
	Keywords      []SyncKeyword       `json:"keywords"`
	IdentityCards []SyncIdentityCard  `json:"identity_cards"`
	BankAccounts  []SyncBankAccount   `json:"bank_accounts"`
	Relationships []SyncRelationship  `json:"relationships"`
	Organizations []SyncOrganization  `json:"organizations"`
	ContactOrgs   []SyncContactOrg    `json:"contact_organizations"`
	Locations     []SyncLocation      `json:"locations"`
	Nationalities []SyncNationality   `json:"nationalities"`
}

// Export is the downloadable document.
type Export struct {
	Format     string     `json:"format"`
	Version    int        `json:"version"`
	ExportedAt string     `json:"exported_at"`
	Filtered   bool       `json:"filtered"`
	Data       ExportData `json:"data"`
}

// ExportAll returns the user's live data. A non-nil contactIDs restricts it to
// those contacts and what hangs off them.
func (s *Store) ExportAll(userID string, contactIDs map[string]bool) (Export, error) {
	changes, err := s.SyncChanges(userID, 0)
	if err != nil {
		return Export{}, err
	}
	return buildExport(changes, contactIDs, time.Now()), nil
}

// live drops tombstones and rows whose contact is not in keep.
func live[T any](rows []SyncRow[T], contactID func(T) string, keep map[string]bool) []T {
	out := []T{}
	for _, r := range rows {
		if r.Deleted || !keep[contactID(r.Row)] {
			continue
		}
		out = append(out, r.Row)
	}
	return out
}

func buildExport(c SyncChanges, contactIDs map[string]bool, now time.Time) Export {
	// Children of deleted (or unselected) contacts never leave the server.
	keep := map[string]bool{}
	for _, r := range c.Contacts {
		if r.Deleted || (contactIDs != nil && !contactIDs[r.Row.ContactID]) {
			continue
		}
		keep[r.Row.ContactID] = true
	}

	d := ExportData{
		Phones:        live(c.Phones, func(x SyncPhone) string { return x.ContactID }, keep),
		Emails:        live(c.Emails, func(x SyncEmail) string { return x.ContactID }, keep),
		Urls:          live(c.Urls, func(x SyncUrl) string { return x.ContactID }, keep),
		Notes:         live(c.Notes, func(x model.ContactNote) string { return x.ContactID }, keep),
		Keywords:      live(c.Keywords, func(x SyncKeyword) string { return x.ContactID }, keep),
		IdentityCards: live(c.IdentityCards, func(x SyncIdentityCard) string { return x.ContactID }, keep),
		BankAccounts:  live(c.BankAccounts, func(x SyncBankAccount) string { return x.ContactID }, keep),
		Relationships: live(c.Relationships, func(x SyncRelationship) string { return x.ContactID }, keep),
		ContactOrgs:   live(c.ContactOrgs, func(x SyncContactOrg) string { return x.ContactID }, keep),
		Locations:     live(c.Locations, func(x SyncLocation) string { return x.ContactID }, keep),
		Nationalities: live(c.Nationalities, func(x SyncNationality) string { return x.ContactID }, keep),
	}
	d.Contacts = live(c.Contacts, func(x model.Contact) string { return x.ContactID }, keep)

	// A full export keeps every organization; a filtered one only those the
	// selected contacts belong to.
	usedOrgs := map[string]bool{}
	for _, co := range d.ContactOrgs {
		usedOrgs[co.OrganizationID] = true
	}
	d.Organizations = []SyncOrganization{}
	for _, o := range c.Organizations {
		if o.Deleted || (contactIDs != nil && !usedOrgs[o.Row.OrganizationID]) {
			continue
		}
		d.Organizations = append(d.Organizations, o.Row)
	}

	return Export{
		Format:     ExportFormat,
		Version:    ExportVersion,
		ExportedAt: now.UTC().Format(time.RFC3339),
		Filtered:   contactIDs != nil,
		Data:       d,
	}
}
