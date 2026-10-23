package app

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"

	"contacts/pkg/auth"
	"contacts/pkg/model"
)

const maxPushChanges = 200

const (
	pushApplied  = "applied"
	pushNotFound = "not_found"
	pushInvalid  = "invalid"
	pushError    = "error"
)

type pushChange struct {
	Entity    string          `json:"entity"`
	Op        string          `json:"op"`
	ID        string          `json:"id"`
	ContactID string          `json:"contact_id,omitempty"`
	Data      json.RawMessage `json:"data"`
}

type pushResult struct {
	Index      int    `json:"index"`
	Entity     string `json:"entity"`
	ID         string `json:"id"`
	Status     string `json:"status"`
	HTTPStatus int    `json:"http_status"`
	Error      string `json:"error,omitempty"`
}

var entityRanks = map[string]int{
	"organization":          0,
	"contact":               1,
	"phone":                 2,
	"email":                 3,
	"url":                   4,
	"note":                  5,
	"keyword":               6,
	"card":                  7,
	"bank_account":          8,
	"relationship":          9,
	"contact_organization": 10,
	"location":              11,
	"nationality":           12,
}

func (a *App) syncPush(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Changes []pushChange `json:"changes"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Changes) == 0 {
		errResp(w, http.StatusBadRequest, "changes must not be empty")
		return
	}
	if len(req.Changes) > maxPushChanges {
		errResp(w, http.StatusBadRequest, fmt.Sprintf("at most %d changes per request", maxPushChanges))
		return
	}

	for i, c := range req.Changes {
		if _, ok := entityRanks[c.Entity]; !ok {
			errResp(w, http.StatusBadRequest, fmt.Sprintf("changes[%d]: unknown entity %q", i, c.Entity))
			return
		}
		if c.Op != "upsert" && c.Op != "delete" {
			errResp(w, http.StatusBadRequest, fmt.Sprintf("changes[%d]: op must be upsert or delete", i))
			return
		}
	}

	// Ordenar: primero upserts por orden de dependencia, luego deletes en orden inverso
	order := make([]int, len(req.Changes))
	for i := range order {
		order[i] = i
	}
	sort.SliceStable(order, func(x, y int) bool {
		cx, cy := req.Changes[order[x]], req.Changes[order[y]]
		rx, ry := entityRanks[cx.Entity], entityRanks[cy.Entity]
		if cx.Op == "delete" {
			rx = 100 - rx
		}
		if cy.Op == "delete" {
			ry = 100 - ry
		}
		return rx < ry
	})

	userID := auth.GetUser(r).UserID
	results := make([]pushResult, len(req.Changes))

	for _, idx := range order {
		c := req.Changes[idx]
		status, code, errMsg := a.applyPushChange(userID, c)
		results[idx] = pushResult{
			Index:      idx,
			Entity:     c.Entity,
			ID:         c.ID,
			Status:     status,
			HTTPStatus: code,
			Error:      errMsg,
		}
	}

	dataResp(w, http.StatusOK, map[string]any{"results": results})
}

func (a *App) applyPushChange(userID string, c pushChange) (status string, code int, errMsg string) {
	if c.Op == "delete" {
		return a.applyPushDelete(userID, c)
	}
	return a.applyPushUpsert(userID, c)
}

func (a *App) applyPushDelete(userID string, c pushChange) (string, int, string) {
	tableMap := map[string][2]string{
		"contact":               {"contacts", "contact_id"},
		"phone":                 {"contact_phones", "phone_id"},
		"email":                 {"contact_emails", "email_id"},
		"url":                   {"contact_urls", "url_id"},
		"note":                  {"contact_notes", "note_id"},
		"keyword":               {"contact_keywords", "keyword"},
		"card":                  {"identity_cards", "card_id"},
		"bank_account":          {"contact_bank_accounts", "bank_account_id"},
		"contact_organization": {"contact_organizations", "organization_id"},
		"location":              {"contact_locations", "location_id"},
		"nationality":           {"contact_nationalities", "nationality_id"},
		"organization":          {"organizations", "organization_id"},
	}

	mapping, ok := tableMap[c.Entity]
	if !ok {
		return pushInvalid, http.StatusBadRequest, "unsupported delete entity"
	}

	err := a.store.SoftDeleteEntity(mapping[0], mapping[1], userID, c.ContactID, c.ID)
	if err != nil {
		log.Printf("sync push delete error: %v", err)
		return pushError, http.StatusInternalServerError, "failed to delete entity"
	}
	return pushApplied, http.StatusOK, ""
}

func (a *App) applyPushUpsert(userID string, c pushChange) (string, int, string) {
	switch c.Entity {
	case "organization":
		var o struct {
			Name string `json:"name"`
		}
		if err := json.Unmarshal(c.Data, &o); err != nil || strings.TrimSpace(o.Name) == "" {
			return pushInvalid, http.StatusBadRequest, "organization name is required"
		}
		if err := a.store.UpsertOrganization(userID, c.ID, strings.TrimSpace(o.Name)); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "contact":
		var ct model.Contact
		if err := json.Unmarshal(c.Data, &ct); err != nil {
			return pushInvalid, http.StatusBadRequest, "invalid contact data"
		}
		ct.ContactID = c.ID
		if ct.ContactID == "" || ct.FirstName == "" || ct.Surname == "" {
			return pushInvalid, http.StatusBadRequest, "contact_id, first_name and surname required"
		}
		if err := a.store.UpsertContact(userID, ct); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "phone":
		var p model.ContactPhone
		if err := json.Unmarshal(c.Data, &p); err != nil || p.Phone == "" {
			return pushInvalid, http.StatusBadRequest, "phone is required"
		}
		p.PhoneID = c.ID
		if err := a.store.UpsertPhone(userID, c.ContactID, p); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "email":
		var e model.ContactEmail
		if err := json.Unmarshal(c.Data, &e); err != nil || e.Email == "" {
			return pushInvalid, http.StatusBadRequest, "email is required"
		}
		e.EmailID = c.ID
		if err := a.store.UpsertEmail(userID, c.ContactID, e); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "url":
		var u model.ContactUrl
		if err := json.Unmarshal(c.Data, &u); err != nil || u.URL == "" {
			return pushInvalid, http.StatusBadRequest, "url is required"
		}
		u.URLID = c.ID
		if err := a.store.UpsertUrl(userID, c.ContactID, u); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "note":
		var n model.ContactNote
		if err := json.Unmarshal(c.Data, &n); err != nil || n.Note == "" {
			return pushInvalid, http.StatusBadRequest, "note is required"
		}
		n.NoteID = c.ID
		if err := a.store.UpsertNote(userID, c.ContactID, n); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "keyword":
		keyword := c.ID
		if keyword == "" {
			return pushInvalid, http.StatusBadRequest, "keyword is required"
		}
		if err := a.store.UpsertKeyword(userID, c.ContactID, keyword); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "card":
		var cd model.IdentityCard
		if err := json.Unmarshal(c.Data, &cd); err != nil || cd.CardNumber == "" {
			return pushInvalid, http.StatusBadRequest, "card_number is required"
		}
		cd.CardID = c.ID
		if err := a.store.UpsertCard(userID, c.ContactID, cd); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "bank_account":
		var b model.ContactBankAccount
		if err := json.Unmarshal(c.Data, &b); err != nil || b.AccountNumber == "" {
			return pushInvalid, http.StatusBadRequest, "account_number is required"
		}
		b.BankAccountID = c.ID
		if err := a.store.UpsertBankAccount(userID, c.ContactID, b); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "relationship":
		var r struct {
			RelatedContactID string `json:"related_contact_id"`
			TypeID           string `json:"type_id"`
		}
		if err := json.Unmarshal(c.Data, &r); err != nil || r.RelatedContactID == "" || r.TypeID == "" {
			return pushInvalid, http.StatusBadRequest, "related_contact_id and type_id are required"
		}
		if err := a.store.UpsertRelationship(userID, c.ContactID, r.RelatedContactID, r.TypeID); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "contact_organization":
		var co model.ContactOrganization
		if err := json.Unmarshal(c.Data, &co); err != nil || co.OrganizationID == "" {
			return pushInvalid, http.StatusBadRequest, "organization_id is required"
		}
		if err := a.store.UpsertContactOrg(userID, c.ContactID, co); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "location":
		var l model.ContactLocation
		if err := json.Unmarshal(c.Data, &l); err != nil {
			return pushInvalid, http.StatusBadRequest, "invalid location data"
		}
		l.LocationID = c.ID
		if err := a.store.UpsertLocation(userID, c.ContactID, l); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""

	case "nationality":
		var n model.ContactNationality
		if err := json.Unmarshal(c.Data, &n); err != nil || n.CountryCode == "" {
			return pushInvalid, http.StatusBadRequest, "country_code is required"
		}
		n.NationalityID = c.ID
		if err := a.store.UpsertNationality(userID, c.ContactID, n); err != nil {
			return pushError, http.StatusInternalServerError, err.Error()
		}
		return pushApplied, http.StatusOK, ""
	}

	return pushInvalid, http.StatusBadRequest, "unsupported entity"
}
