package app

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

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

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

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

func errResp(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
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
	if req.Email == "" || req.Password == "" || req.Name == "" {
		errResp(w, http.StatusBadRequest, "email, name, and password are required")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := a.store.Register(req.Email, req.Name, string(hash))
	if err != nil {
		errResp(w, http.StatusConflict, "email already exists")
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

func (a *App) listContacts(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	search := r.URL.Query().Get("search")

	contacts, err := a.store.ListContacts(claims.UserID, search)
	if err != nil {
		log.Printf("listContacts error: %v", err)
		errResp(w, http.StatusInternalServerError, "failed to list contacts")
		return
	}
	if contacts == nil {
		contacts = []model.Contact{}
	}
	dataResp(w, http.StatusOK, contacts)
}

func (a *App) createContact(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	var c model.Contact
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var c model.Contact
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c.UserID = claims.UserID
	c.ContactID = contactID

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

// --- phones ---

func (a *App) listPhones(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	items, err := a.store.ListPhones(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list phones")
		return
	}
	if items == nil {
		items = []model.ContactPhone{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createPhone(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var p model.ContactPhone
	if err := decodeJSON(r, &p); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var p model.ContactPhone
	if err := decodeJSON(r, &p); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	p.UserID = claims.UserID
	p.ContactID = contactID
	p.PhoneID = phoneID

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

	items, err := a.store.ListEmails(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list emails")
		return
	}
	if items == nil {
		items = []model.ContactEmail{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createEmail(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var e model.ContactEmail
	if err := decodeJSON(r, &e); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var e model.ContactEmail
	if err := decodeJSON(r, &e); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	e.UserID = claims.UserID
	e.ContactID = contactID
	e.EmailID = emailID

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

	items, err := a.store.ListUrls(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list urls")
		return
	}
	if items == nil {
		items = []model.ContactUrl{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createURL(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var u model.ContactUrl
	if err := decodeJSON(r, &u); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var u model.ContactUrl
	if err := decodeJSON(r, &u); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	u.UserID = claims.UserID
	u.ContactID = contactID
	u.URLID = urlID

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

	items, err := a.store.ListNotes(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list notes")
		return
	}
	if items == nil {
		items = []model.ContactNote{}
	}
	dataResp(w, http.StatusOK, items)
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

	items, err := a.store.ListKeywords(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list keywords")
		return
	}
	if items == nil {
		items = []model.ContactKeyword{}
	}
	dataResp(w, http.StatusOK, items)
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

	items, err := a.store.ListCards(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list cards")
		return
	}
	if items == nil {
		items = []model.IdentityCard{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createCard(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var c model.IdentityCard
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var c model.IdentityCard
	if err := decodeJSON(r, &c); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	c.UserID = claims.UserID
	c.ContactID = contactID
	c.CardID = cardID

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

	items, err := a.store.ListBankAccounts(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list bank accounts")
		return
	}
	if items == nil {
		items = []model.ContactBankAccount{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createBankAccount(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var b model.ContactBankAccount
	if err := decodeJSON(r, &b); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var b model.ContactBankAccount
	if err := decodeJSON(r, &b); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	b.UserID = claims.UserID
	b.ContactID = contactID
	b.BankAccountID = bankAccountID

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

	items, err := a.store.ListRelationships(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list relationships")
		return
	}
	if items == nil {
		items = []model.ContactRelationship{}
	}
	dataResp(w, http.StatusOK, items)
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

	items, err := a.store.ListOrganizations(claims.UserID, contactID)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to list contact organizations")
		return
	}
	if items == nil {
		items = []model.ContactOrganization{}
	}
	dataResp(w, http.StatusOK, items)
}

func (a *App) createContactOrganization(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetUser(r)
	contactID := chi.URLParam(r, "id")

	var co model.ContactOrganization
	if err := decodeJSON(r, &co); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
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

	var co model.ContactOrganization
	if err := decodeJSON(r, &co); err != nil {
		errResp(w, http.StatusBadRequest, "invalid request body")
		return
	}
	co.UserID = claims.UserID
	co.ContactID = contactID
	co.OrganizationID = organizationID

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

	contacts, err := a.store.GetBirthdaysThisMonth(claims.UserID, month, year)
	if err != nil {
		errResp(w, http.StatusInternalServerError, "failed to get birthdays")
		return
	}
	if contacts == nil {
		contacts = []model.Contact{}
	}
	dataResp(w, http.StatusOK, contacts)
}
