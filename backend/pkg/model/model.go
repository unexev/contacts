package model

import (
	"database/sql"
	"encoding/json"
)

type User struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type Contact struct {
	UserID        string         `json:"user_id"`
	ContactID     string         `json:"contact_id"`
	FirstName     string         `json:"first_name"`
	MiddleName    sql.NullString `json:"middle_name"`
	Surname       string         `json:"surname"`
	Birthdate     sql.NullString `json:"birthdate"`
	Gender        sql.NullString `json:"gender"`
	StatusID      sql.NullString `json:"status_id"`
	MaritalStatus sql.NullString `json:"marital_status"`
	Deceased      bool           `json:"deceased"`
	UpdatedAt     int64          `json:"updated_at"`
}

// MarshalJSON implements custom JSON marshaling to handle NullString
func (c Contact) MarshalJSON() ([]byte, error) {
	type Alias Contact
	return json.Marshal(&struct {
		Alias
		MiddleName    string  `json:"middle_name"`
		Birthdate     *string `json:"birthdate"`
		Gender        *string `json:"gender"`
		StatusID      *string `json:"status_id"`
		MaritalStatus string  `json:"marital_status"`
		Deceased      bool    `json:"deceased"`
	}{
		Alias:         (Alias)(c),
		MiddleName:    c.MiddleName.String,
		Birthdate:     nullStrPtr(c.Birthdate),
		Gender:        nullStrPtr(c.Gender),
		StatusID:      nullStrPtr(c.StatusID),
		MaritalStatus: c.MaritalStatus.String,
		Deceased:      c.Deceased,
	})
}

func nullStrPtr(ns sql.NullString) *string {
	if ns.Valid {
		return &ns.String
	}
	return nil
}

type ContactPhone struct {
	UserID    string         `json:"user_id"`
	ContactID string         `json:"contact_id"`
	PhoneID   string         `json:"phone_id"`
	Phone     string         `json:"phone"`
	Label     sql.NullString `json:"label"`
	CreatedAt int64          `json:"created_at"`
	IsActive  bool           `json:"is_active"`
}

type ContactEmail struct {
	UserID    string         `json:"user_id"`
	ContactID string         `json:"contact_id"`
	EmailID   string         `json:"email_id"`
	Email     string         `json:"email"`
	Label     sql.NullString `json:"label"`
}

type ContactUrl struct {
	UserID    string         `json:"user_id"`
	ContactID string         `json:"contact_id"`
	URLID     string         `json:"url_id"`
	URL       string         `json:"url"`
	Label     sql.NullString `json:"label"`
}

type ContactNote struct {
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	NoteID    string `json:"note_id"`
	Note      string `json:"note"`
	UpdatedAt int64  `json:"updated_at"`
}

type ContactKeyword struct {
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	Keyword   string `json:"keyword"`
}

type IdentityCard struct {
	UserID     string         `json:"user_id"`
	ContactID  string         `json:"contact_id"`
	CardID     string         `json:"card_id"`
	DocType    string         `json:"doc_type"`
	CardNumber string         `json:"card_number"`
	IssueDate  sql.NullString `json:"issue_date"`
	ExpiryDate sql.NullString `json:"expiry_date"`
}

type ContactBankAccount struct {
	UserID        string         `json:"user_id"`
	ContactID     string         `json:"contact_id"`
	BankAccountID string         `json:"bank_account_id"`
	BankName      sql.NullString `json:"bank_name"`
	AccountNumber string         `json:"account_number"`
	AccountType   sql.NullString `json:"account_type"`
	Label         sql.NullString `json:"label"`
}

type ContactRelationship struct {
	UserID             string `json:"user_id"`
	ContactID          string `json:"contact_id"`
	RelatedContactID   string `json:"related_contact_id"`
	RelatedContactName string `json:"related_contact_name"`
	TypeID             string `json:"type_id"`
	TypeLabel          string `json:"type_label"`
}

type ContactOrganization struct {
	UserID           string         `json:"user_id"`
	ContactID        string         `json:"contact_id"`
	OrganizationID   string         `json:"organization_id"`
	OrganizationName string         `json:"organization_name"`
	Achievement      sql.NullString `json:"achievement"`
	Date             sql.NullString `json:"date"`
}

type ContactLocation struct {
	UserID       string   `json:"user_id"`
	ContactID    string   `json:"contact_id"`
	LocationID   string   `json:"location_id"`
	LocationType string   `json:"location_type"`
	Address      string   `json:"address"`
	City         string   `json:"city"`
	Region       string   `json:"region"`
	Country      string   `json:"country"`
	PostalCode   string   `json:"postal_code"`
	Latitude     *float64 `json:"latitude"`
	Longitude    *float64 `json:"longitude"`
}

type MaritalStatus struct {
	StatusID      string `json:"status_id"`
	MaritalStatus string `json:"marital_status"`
}

type RelationshipType struct {
	TypeID string `json:"type_id"`
	Label  string `json:"label"`
}

type Organization struct {
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
}
