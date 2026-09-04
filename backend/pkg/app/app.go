package app

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"contacts/pkg/auth"
	"contacts/pkg/model"
	"contacts/pkg/store"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type App struct {
	store *store.Store
	auth  *auth.Manager
}

func New(s *store.Store, a *auth.Manager) *App {
	return &App{store: s, auth: a}
}

func (a *App) Handler() http.Handler {
	r := chi.NewRouter()

	r.Use(securityHeaders)
	r.Use(CORS())
	r.Use(rateLimit(30))

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/register", a.register)
		r.Post("/auth/login", a.login)
		r.Group(func(r chi.Router) {
			r.Use(a.auth.Middleware)
			r.Get("/auth/me", a.me)

			r.Get("/contacts", a.listContacts)
			r.Post("/contacts", a.createContact)
			r.Get("/contacts/{id}", a.getContact)
			r.Put("/contacts/{id}", a.updateContact)
			r.Delete("/contacts/{id}", a.deleteContact)

			r.Get("/contacts/{id}/locations", a.listLocations)
			r.Post("/contacts/{id}/locations", a.createLocation)
			r.Put("/contacts/{id}/locations/{locationId}", a.updateLocation)
			r.Delete("/contacts/{id}/locations/{locationId}", a.deleteLocation)

			r.Get("/contacts/{id}/nationalities", a.listNationalities)
			r.Post("/contacts/{id}/nationalities", a.createNationality)
			r.Put("/contacts/{id}/nationalities/{nationalityId}", a.updateNationality)
			r.Delete("/contacts/{id}/nationalities/{nationalityId}", a.deleteNationality)

			r.Get("/contacts/{id}/phones", a.listPhones)
			r.Post("/contacts/{id}/phones", a.createPhone)
			r.Put("/contacts/{id}/phones/{phoneId}", a.updatePhone)
			r.Delete("/contacts/{id}/phones/{phoneId}", a.deletePhone)

			r.Get("/contacts/{id}/emails", a.listEmails)
			r.Post("/contacts/{id}/emails", a.createEmail)
			r.Put("/contacts/{id}/emails/{emailId}", a.updateEmail)
			r.Delete("/contacts/{id}/emails/{emailId}", a.deleteEmail)

			r.Get("/contacts/{id}/urls", a.listURLs)
			r.Post("/contacts/{id}/urls", a.createURL)
			r.Put("/contacts/{id}/urls/{urlId}", a.updateURL)
			r.Delete("/contacts/{id}/urls/{urlId}", a.deleteURL)

			r.Get("/contacts/{id}/notes", a.listNotes)
			r.Post("/contacts/{id}/notes", a.createNote)
			r.Put("/contacts/{id}/notes/{noteId}", a.updateNote)
			r.Delete("/contacts/{id}/notes/{noteId}", a.deleteNote)

			r.Get("/contacts/{id}/keywords", a.listKeywords)
			r.Post("/contacts/{id}/keywords", a.createKeyword)
			r.Delete("/contacts/{id}/keywords/{keyword}", a.deleteKeyword)

			r.Get("/contacts/{id}/cards", a.listCards)
			r.Post("/contacts/{id}/cards", a.createCard)
			r.Put("/contacts/{id}/cards/{cardId}", a.updateCard)
			r.Delete("/contacts/{id}/cards/{cardId}", a.deleteCard)

			r.Get("/contacts/{id}/bank-accounts", a.listBankAccounts)
			r.Post("/contacts/{id}/bank-accounts", a.createBankAccount)
			r.Put("/contacts/{id}/bank-accounts/{bankAccountId}", a.updateBankAccount)
			r.Delete("/contacts/{id}/bank-accounts/{bankAccountId}", a.deleteBankAccount)

			r.Get("/contacts/{id}/relationships", a.listRelationships)
			r.Post("/contacts/{id}/relationships", a.createRelationship)
			r.Delete("/contacts/{id}/relationships/{relatedContactId}", a.deleteRelationship)

			r.Get("/contacts/{id}/organizations", a.listContactOrganizations)
			r.Post("/contacts/{id}/organizations", a.createContactOrganization)
			r.Put("/contacts/{id}/organizations/{organizationId}", a.updateContactOrganization)
			r.Delete("/contacts/{id}/organizations/{organizationId}", a.deleteContactOrganization)

			r.Get("/marital-statuses", a.listMaritalStatuses)
			r.Get("/relationship-types", a.listRelationshipTypes)
			r.Get("/organizations", a.listOrganizations)
			r.Post("/organizations", a.createOrganization)

			r.Get("/birthdays", a.getBirthdays)
		})
	})

	return r
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func dataResp(w http.ResponseWriter, status int, v any) {
	writeJSON(w, status, map[string]any{"data": v})
}

func paginatedResp(w http.ResponseWriter, status int, data any, total, limit, offset int) {
	writeJSON(w, status, map[string]any{
		"data":   data,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

func errResp(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func parsePagination(r *http.Request) (limit, offset int) {
	limit = 50
	offset = 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}
	return
}

func nullString(s string) sql.NullString {
	s = strings.TrimSpace(s)
	return sql.NullString{String: s, Valid: s != ""}
}

func boolOrDefault(v *bool, def bool) bool {
	if v != nil {
		return *v
	}
	return def
}

type phoneRequest struct {
	Phone     string `json:"phone"`
	Label     string `json:"label"`
	IsActive  *bool  `json:"is_active"`
	CreatedAt *int64 `json:"created_at"`
}

type emailRequest struct {
	Email string `json:"email"`
	Label string `json:"label"`
}

type urlRequest struct {
	URL   string `json:"url"`
	Label string `json:"label"`
}

type bankRequest struct {
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountType   string `json:"account_type"`
	Label         string `json:"label"`
}

type cardRequest struct {
	DocType    string `json:"doc_type"`
	CardNumber string `json:"card_number"`
	IssueDate  string `json:"issue_date"`
	ExpiryDate string `json:"expiry_date"`
}

type nationalityRequest struct {
	CountryCode string `json:"country_code"`
	AcquiredAt  string `json:"acquired_at"`
	Note        string `json:"note"`
}

// --- auth handlers ---

func (a *App) register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		errResp(w, http.StatusBadRequest, "email and password are required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := a.store.Register(req.Email, req.Name, string(hash))
	if err != nil {
		log.Printf("register error: %v", err)
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	dataResp(w, http.StatusCreated, model.AuthResponse{Token: token, User: user})
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, hash, err := a.store.GetUserByEmailWithHash(req.Email)
	if err != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		errResp(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := a.auth.Generate(user.UserID, user.Email, user.Role)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	dataResp(w, http.StatusOK, model.AuthResponse{Token: token, User: user})
}

func (a *App) me(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	user, err := a.store.GetUserByID(claims.UserID)
	if err != nil {
		errResp(w, http.StatusNotFound, "user not found")
		return
	}
	dataResp(w, http.StatusOK, user)
}

// --- contacts ---

type ContactFilters struct {
	Search           string
	Gender           string
	HasBirthday      *bool
	HasIDCard        *bool
	HasOrganization  *bool
	HasMaritalStatus *bool
}

func parseBoolPtr(s string) *bool {
	switch s {
	case "true", "1", "yes":
		v := true
		return &v
	case "false", "0", "no":
		v := false
		return &v
	default:
		return nil
	}
}

func (a *App) listContacts(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	limit, offset := parsePagination(r)

	filters := ContactFilters{
		Search:           r.URL.Query().Get("search"),
		Gender:           strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("gender"))),
		HasBirthday:      parseBoolPtr(r.URL.Query().Get("has_birthday")),
		HasIDCard:        parseBoolPtr(r.URL.Query().Get("has_id_card")),
		HasOrganization:  parseBoolPtr(r.URL.Query().Get("has_organization")),
		HasMaritalStatus: parseBoolPtr(r.URL.Query().Get("has_marital_status")),
	}

	contacts, total, err := a.store.ListContacts(claims.UserID, filters.Search, filters.Gender,
		filters.HasBirthday, filters.HasIDCard, filters.HasOrganization, filters.HasMaritalStatus,
		limit, offset)
	if err != nil {
		log.Printf("listContacts error: user=%s search=%q err=%v", claims.UserID, filters.Search, err)
		errResp(w, http.StatusInternalServerError, "failed to list contacts")
		return
	}
	if contacts == nil {
		contacts = []model.Contact{}
	}
	paginatedResp(w, http.StatusOK, contacts, total, limit, offset)
}

func (a *App) createContact(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var req struct {
		FirstName  string `json:"first_name"`
		MiddleName string `json:"middle_name"`
		Surname    string `json:"surname"`
		Birthdate  string `json:"birthdate"`
		Gender     string `json:"gender"`
		StatusID   string `json:"status_id"`
		Deceased   bool   `json:"deceased"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := model.Contact{
		FirstName:  strings.ToUpper(strings.TrimSpace(req.FirstName)),
		Surname:    strings.ToUpper(strings.TrimSpace(req.Surname)),
		MiddleName: nullString(strings.ToUpper(req.MiddleName)),
		Birthdate:  nullString(req.Birthdate),
		Gender:     nullString(req.Gender),
		StatusID:   nullString(req.StatusID),
		Deceased:   req.Deceased,
	}

	created, err := a.store.CreateContact(claims.UserID, c)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create contact")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) getContact(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	c, err := a.store.GetContactFull(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusNotFound, "contact not found")
		return
	}
	dataResp(w, http.StatusOK, c)
}

func (a *App) updateContact(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req struct {
		FirstName  string `json:"first_name"`
		MiddleName string `json:"middle_name"`
		Surname    string `json:"surname"`
		Birthdate  string `json:"birthdate"`
		Gender     string `json:"gender"`
		StatusID   string `json:"status_id"`
		Deceased   bool   `json:"deceased"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := model.Contact{
		UserID: claims.UserID, ContactID: contactID,
		FirstName: strings.ToUpper(strings.TrimSpace(req.FirstName)), Surname: strings.ToUpper(strings.TrimSpace(req.Surname)),
		MiddleName: nullString(strings.ToUpper(req.MiddleName)),
		Birthdate:  nullString(req.Birthdate),
		Gender:     nullString(req.Gender),
		StatusID:   nullString(req.StatusID),
		Deceased:   req.Deceased,
	}

	if err := a.store.UpdateContact(claims.UserID, c); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update contact")
		return
	}
	dataResp(w, http.StatusOK, c)
}

func (a *App) deleteContact(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	if err := a.store.DeleteContact(claims.UserID, contactID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete contact")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- locations ---

func (a *App) listLocations(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	limit, offset := parsePagination(r)
	items, total, err := a.store.ListLocations(claims.UserID, chi.URLParam(r, "id"), limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list locations")
		return
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createLocation(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var location model.ContactLocation
	if err := decodeJSON(r, &location); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	created, err := a.store.CreateLocation(claims.UserID, chi.URLParam(r, "id"), location)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create location")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateLocation(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var location model.ContactLocation
	if err := decodeJSON(r, &location); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	contactID, locationID := chi.URLParam(r, "id"), chi.URLParam(r, "locationId")
	location.UserID, location.ContactID, location.LocationID = claims.UserID, contactID, locationID
	if err := a.store.UpdateLocation(claims.UserID, contactID, location); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update location")
		return
	}
	dataResp(w, http.StatusOK, location)
}

func (a *App) deleteLocation(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	if err := a.store.DeleteLocation(claims.UserID, chi.URLParam(r, "id"), chi.URLParam(r, "locationId")); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete location")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- nationalities ---

func (a *App) listNationalities(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)
	items, total, err := a.store.ListNationalities(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list nationalities")
		return
	}
	if items == nil {
		items = []model.ContactNationality{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createNationality(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	var req nationalityRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.CountryCode) == "" {
		errResp(w, http.StatusBadRequest, "country_code is required")
		return
	}
	n := model.ContactNationality{
		CountryCode: strings.ToUpper(strings.TrimSpace(req.CountryCode)),
		AcquiredAt:  nullString(req.AcquiredAt),
		Note:        nullString(req.Note),
	}
	created, err := a.store.CreateNationality(claims.UserID, contactID, n)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create nationality")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateNationality(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	nationalityID := chi.URLParam(r, "nationalityId")
	var req nationalityRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n := model.ContactNationality{
		UserID:        claims.UserID,
		ContactID:     contactID,
		NationalityID: nationalityID,
		CountryCode:   strings.ToUpper(strings.TrimSpace(req.CountryCode)),
		AcquiredAt:    nullString(req.AcquiredAt),
		Note:          nullString(req.Note),
	}
	if err := a.store.UpdateNationality(claims.UserID, contactID, n); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update nationality")
		return
	}
	dataResp(w, http.StatusOK, n)
}

func (a *App) deleteNationality(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	nationalityID := chi.URLParam(r, "nationalityId")
	if err := a.store.DeleteNationality(claims.UserID, contactID, nationalityID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete nationality")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- phones ---

func (a *App) listPhones(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListPhones(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list phones")
		return
	}
	if items == nil {
		items = []model.ContactPhone{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createPhone(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req phoneRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		errResp(w, http.StatusBadRequest, "phone is required")
		return
	}
	p := model.ContactPhone{
		Phone:     strings.TrimSpace(req.Phone),
		Label:     nullString(req.Label),
		IsActive:  boolOrDefault(req.IsActive, true),
		CreatedAt: 0,
	}
	if req.CreatedAt != nil {
		p.CreatedAt = *req.CreatedAt
	}

	created, err := a.store.CreatePhone(claims.UserID, contactID, p)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create phone")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updatePhone(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	phoneID := chi.URLParam(r, "phoneId")

	var req phoneRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p := model.ContactPhone{
		UserID:    claims.UserID,
		ContactID: contactID,
		PhoneID:   phoneID,
		Phone:     strings.TrimSpace(req.Phone),
		Label:     nullString(req.Label),
		IsActive:  boolOrDefault(req.IsActive, false),
	}

	if err := a.store.UpdatePhone(claims.UserID, contactID, p); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update phone")
		return
	}
	dataResp(w, http.StatusOK, p)
}

func (a *App) deletePhone(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	phoneID := chi.URLParam(r, "phoneId")

	if err := a.store.DeletePhone(claims.UserID, contactID, phoneID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete phone")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- emails ---

func (a *App) listEmails(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListEmails(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list emails")
		return
	}
	if items == nil {
		items = []model.ContactEmail{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createEmail(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req emailRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Email) == "" {
		errResp(w, http.StatusBadRequest, "email is required")
		return
	}
	e := model.ContactEmail{
		Email: strings.TrimSpace(req.Email),
		Label: nullString(req.Label),
	}

	created, err := a.store.CreateEmail(claims.UserID, contactID, e)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create email")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateEmail(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	emailID := chi.URLParam(r, "emailId")

	var req emailRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	e := model.ContactEmail{
		UserID:    claims.UserID,
		ContactID: contactID,
		EmailID:   emailID,
		Email:     strings.TrimSpace(req.Email),
		Label:     nullString(req.Label),
	}

	if err := a.store.UpdateEmail(claims.UserID, contactID, e); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update email")
		return
	}
	dataResp(w, http.StatusOK, e)
}

func (a *App) deleteEmail(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	emailID := chi.URLParam(r, "emailId")

	if err := a.store.DeleteEmail(claims.UserID, contactID, emailID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete email")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- urls ---

func (a *App) listURLs(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListUrls(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list urls")
		return
	}
	if items == nil {
		items = []model.ContactUrl{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createURL(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req urlRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		errResp(w, http.StatusBadRequest, "url is required")
		return
	}
	u := model.ContactUrl{
		URL:   strings.TrimSpace(req.URL),
		Label: nullString(req.Label),
	}

	created, err := a.store.CreateUrl(claims.UserID, contactID, u)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create url")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateURL(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	urlID := chi.URLParam(r, "urlId")

	var req urlRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	u := model.ContactUrl{
		UserID:    claims.UserID,
		ContactID: contactID,
		URLID:     urlID,
		URL:       strings.TrimSpace(req.URL),
		Label:     nullString(req.Label),
	}

	if err := a.store.UpdateUrl(claims.UserID, contactID, u); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update url")
		return
	}
	dataResp(w, http.StatusOK, u)
}

func (a *App) deleteURL(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	urlID := chi.URLParam(r, "urlId")

	if err := a.store.DeleteUrl(claims.UserID, contactID, urlID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete url")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- notes ---

func (a *App) listNotes(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListNotes(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list notes")
		return
	}
	if items == nil {
		items = []model.ContactNote{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createNote(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var n model.ContactNote
	if err := decodeJSON(r, &n); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	created, err := a.store.CreateNote(claims.UserID, contactID, n)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create note")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateNote(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	noteID := chi.URLParam(r, "noteId")

	var n model.ContactNote
	if err := decodeJSON(r, &n); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	n.UserID = claims.UserID
	n.ContactID = contactID
	n.NoteID = noteID

	if err := a.store.UpdateNote(claims.UserID, contactID, n); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update note")
		return
	}
	dataResp(w, http.StatusOK, n)
}

func (a *App) deleteNote(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	noteID := chi.URLParam(r, "noteId")

	if err := a.store.DeleteNote(claims.UserID, contactID, noteID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete note")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- keywords ---

func (a *App) listKeywords(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListKeywords(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list keywords")
		return
	}
	if items == nil {
		items = []model.ContactKeyword{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createKeyword(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req struct {
		Keyword string `json:"keyword"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Keyword == "" {
		errResp(w, http.StatusBadRequest, "keyword is required")
		return
	}

	if err := a.store.AddKeyword(claims.UserID, contactID, req.Keyword); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create keyword")
		return
	}
	dataResp(w, http.StatusCreated, model.ContactKeyword{
		UserID:    claims.UserID,
		ContactID: contactID,
		Keyword:   req.Keyword,
	})
}

func (a *App) deleteKeyword(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	keyword := chi.URLParam(r, "keyword")

	if err := a.store.DeleteKeyword(claims.UserID, contactID, keyword); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete keyword")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- cards ---

func (a *App) listCards(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListCards(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list cards")
		return
	}
	if items == nil {
		items = []model.IdentityCard{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createCard(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req cardRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := model.IdentityCard{
		DocType:    strings.TrimSpace(req.DocType),
		CardNumber: strings.TrimSpace(req.CardNumber),
		IssueDate:  nullString(req.IssueDate),
		ExpiryDate: nullString(req.ExpiryDate),
	}

	created, err := a.store.CreateCard(claims.UserID, contactID, c)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create card")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateCard(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	cardID := chi.URLParam(r, "cardId")

	var req cardRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c := model.IdentityCard{
		UserID:     claims.UserID,
		ContactID:  contactID,
		CardID:     cardID,
		DocType:    strings.TrimSpace(req.DocType),
		CardNumber: strings.TrimSpace(req.CardNumber),
		IssueDate:  nullString(req.IssueDate),
		ExpiryDate: nullString(req.ExpiryDate),
	}

	if err := a.store.UpdateCard(claims.UserID, contactID, c); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update card")
		return
	}
	dataResp(w, http.StatusOK, c)
}

func (a *App) deleteCard(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	cardID := chi.URLParam(r, "cardId")

	if err := a.store.DeleteCard(claims.UserID, contactID, cardID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete card")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- bank accounts ---

func (a *App) listBankAccounts(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListBankAccounts(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list bank accounts")
		return
	}
	if items == nil {
		items = []model.ContactBankAccount{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createBankAccount(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req bankRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.AccountNumber) == "" {
		errResp(w, http.StatusBadRequest, "account_number is required")
		return
	}
	b := model.ContactBankAccount{
		BankName:      nullString(req.BankName),
		AccountNumber: strings.TrimSpace(req.AccountNumber),
		AccountType:   nullString(req.AccountType),
		Label:         nullString(req.Label),
	}

	created, err := a.store.CreateBankAccount(claims.UserID, contactID, b)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create bank account")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateBankAccount(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	bankAccountID := chi.URLParam(r, "bankAccountId")

	var req bankRequest
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	b := model.ContactBankAccount{
		UserID:        claims.UserID,
		ContactID:     contactID,
		BankAccountID: bankAccountID,
		BankName:      nullString(req.BankName),
		AccountNumber: strings.TrimSpace(req.AccountNumber),
		AccountType:   nullString(req.AccountType),
		Label:         nullString(req.Label),
	}

	if err := a.store.UpdateBankAccount(claims.UserID, contactID, b); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update bank account")
		return
	}
	dataResp(w, http.StatusOK, b)
}

func (a *App) deleteBankAccount(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	bankAccountID := chi.URLParam(r, "bankAccountId")

	if err := a.store.DeleteBankAccount(claims.UserID, contactID, bankAccountID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete bank account")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- relationships ---

func (a *App) listRelationships(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListRelationships(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list relationships")
		return
	}
	if items == nil {
		items = []model.ContactRelationship{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createRelationship(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var rel model.ContactRelationship
	if err := decodeJSON(r, &rel); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}

	created, err := a.store.CreateRelationship(claims.UserID, contactID, rel)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create relationship")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) deleteRelationship(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	relatedContactID := chi.URLParam(r, "relatedContactId")

	// The store's DeleteRelationship requires a typeID. We'll accept it from query param.
	typeID := r.URL.Query().Get("typeId")
	if typeID == "" {
		errResp(w, http.StatusBadRequest, "typeId query parameter is required")
		return
	}

	if err := a.store.DeleteRelationship(claims.UserID, contactID, relatedContactID, typeID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete relationship")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- contact organizations ---

func (a *App) listContactOrganizations(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	limit, offset := parsePagination(r)

	items, total, err := a.store.ListOrganizations(claims.UserID, contactID, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list contact organizations")
		return
	}
	if items == nil {
		items = []model.ContactOrganization{}
	}
	paginatedResp(w, http.StatusOK, items, total, limit, offset)
}

func (a *App) createContactOrganization(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var req struct {
		OrganizationID string `json:"organization_id"`
		Achievement    string `json:"achievement"`
		Date           string `json:"date"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	co := model.ContactOrganization{
		OrganizationID: strings.TrimSpace(req.OrganizationID),
		Achievement:    nullString(req.Achievement),
		Date:           nullString(req.Date),
	}

	created, err := a.store.CreateOrganization(claims.UserID, contactID, co)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create contact organization")
		return
	}
	dataResp(w, http.StatusCreated, created)
}

func (a *App) updateContactOrganization(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	organizationID := chi.URLParam(r, "organizationId")

	var req struct {
		Achievement string `json:"achievement"`
		Date        string `json:"date"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	co := model.ContactOrganization{
		UserID:         claims.UserID,
		ContactID:      contactID,
		OrganizationID: organizationID,
		Achievement:    nullString(req.Achievement),
		Date:           nullString(req.Date),
	}

	if err := a.store.UpdateOrganization(claims.UserID, contactID, co); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to update contact organization")
		return
	}
	dataResp(w, http.StatusOK, co)
}

func (a *App) deleteContactOrganization(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")
	organizationID := chi.URLParam(r, "organizationId")

	if err := a.store.DeleteOrganization(claims.UserID, contactID, organizationID); err != nil {
		errResp(w, http.StatusInternalServerError, "failed to delete contact organization")
		return
	}
	dataResp(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// --- catalogs ---

func (a *App) listMaritalStatuses(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListMaritalStatuses()
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list marital statuses")
		return
	}
	if items == nil {
		items = []model.MaritalStatus{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) listRelationshipTypes(w http.ResponseWriter, r *http.Request) {
	items, err := a.store.ListRelationshipTypes()
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list relationship types")
		return
	}
	if items == nil {
		items = []model.RelationshipType{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) listOrganizations(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)

	items, err := a.store.ListOrganizationsByUser(claims.UserID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list organizations")
		return
	}
	if items == nil {
		items = []model.Organization{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createOrganization(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)

	var req struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &req); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		errResp(w, http.StatusBadRequest, "name is required")
		return
	}

	o, err := a.store.CreateOrganizationForUser(claims.UserID, req.Name)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to create organization")
		return
	}
	dataResp(w, http.StatusCreated, o)
}

// --- birthdays ---

func (a *App) getBirthdays(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")

	if monthStr == "" || yearStr == "" {
		errResp(w, http.StatusBadRequest, "month and year query parameters are required")
		return
	}

	month, err := strconv.Atoi(monthStr)
	if err != nil {
		errResp(w, http.StatusBadRequest, "month must be a valid integer")
		return
	}
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		errResp(w, http.StatusBadRequest, "year must be a valid integer")
		return
	}

	limit, offset := parsePagination(r)

	contacts, total, err := a.store.GetBirthdaysThisMonth(claims.UserID, month, year, limit, offset)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to get birthdays")
		return
	}
	if contacts == nil {
		contacts = []model.Contact{}
	}
	paginatedResp(w, http.StatusOK, contacts, total, limit, offset)
}
