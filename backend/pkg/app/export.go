package app

import (
	"log"
	"net/http"
	"strings"

	"contacts/pkg/auth"
)

// contactFiltersFromQuery reads the list filters shared by the contact list
// and the export.
func contactFiltersFromQuery(r *http.Request) ContactFilters {
	q := r.URL.Query()
	return ContactFilters{
		Search:             q.Get("search"),
		Gender:             strings.ToUpper(strings.TrimSpace(q.Get("gender"))),
		HasBirthday:        parseBoolPtr(q.Get("has_birthday")),
		HasIDCard:          parseBoolPtr(q.Get("has_id_card")),
		HasOrganization:    parseBoolPtr(q.Get("has_organization")),
		HasMaritalStatus:   parseBoolPtr(q.Get("has_marital_status")),
		HasPhone:           parseBoolPtr(q.Get("has_phone")),
		RelationshipStatus: parseRelationshipStatusFilter(q.Get("relationship_status")),
		HasChildren:        parseBoolPtr(q.Get("has_children")),
		StatusID:           strings.TrimSpace(q.Get("status_id")),
	}
}

func (f ContactFilters) active() bool {
	return f.Search != "" || f.Gender != "" || f.HasBirthday != nil || f.HasIDCard != nil ||
		f.HasOrganization != nil || f.HasMaritalStatus != nil || f.HasPhone != nil ||
		f.RelationshipStatus != "" || f.HasChildren != nil || f.StatusID != ""
}

// exportData sends the user's data as a JSON download. The list filters of
// GET /contacts narrow it down; with none it exports everything.
func (a *App) exportData(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	filters := contactFiltersFromQuery(r)

	var ids map[string]bool
	if filters.active() {
		ids = map[string]bool{}
		const page = 100
		for offset := 0; ; offset += page {
			contacts, total, err := a.store.ListContacts(claims.UserID, filters.Search, filters.Gender,
				filters.HasBirthday, filters.HasIDCard, filters.HasOrganization, filters.HasMaritalStatus, filters.HasPhone,
				filters.RelationshipStatus, filters.HasChildren, filters.StatusID, page, offset)
			if err != nil {
				log.Printf("exportData list error: user=%s err=%v", claims.UserID, err)
				errResp(w, http.StatusInternalServerError, "failed to export data")
				return
			}
			for _, c := range contacts {
				ids[c.ContactID] = true
			}
			if len(contacts) < page || offset+len(contacts) >= total {
				break
			}
		}
	}

	out, err := a.store.ExportAll(claims.UserID, ids)
	if err != nil {
		log.Printf("exportData error: user=%s err=%v", claims.UserID, err)
		errResp(w, http.StatusInternalServerError, "failed to export data")
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="contacts-export.json"`)
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, out)
}
