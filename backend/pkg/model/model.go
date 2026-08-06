package model

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
	UserID        string `json:"user_id"`
	ContactID     string `json:"contact_id"`
	FirstName     string `json:"first_name"`
	MiddleName    string `json:"middle_name"`
	Surname       string `json:"surname"`
	Birthdate     string `json:"birthdate"`
	Gender        string `json:"gender"`
	StatusID      string `json:"status_id"`
	MaritalStatus string `json:"marital_status"`
	UpdatedAt     int64  `json:"updated_at"`
}

type ContactPhone struct {
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	PhoneID   string `json:"phone_id"`
	Phone     string `json:"phone"`
	Label     string `json:"label"`
}

type ContactEmail struct {
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	EmailID   string `json:"email_id"`
	Email     string `json:"email"`
	Label     string `json:"label"`
}

type ContactUrl struct {
	UserID    string `json:"user_id"`
	ContactID string `json:"contact_id"`
	URLID     string `json:"url_id"`
	URL       string `json:"url"`
	Label     string `json:"label"`
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
	UserID      string `json:"user_id"`
	ContactID   string `json:"contact_id"`
	CardID      string `json:"card_id"`
	DocType     string `json:"doc_type"`
	CardNumber  string `json:"card_number"`
	IssueDate   string `json:"issue_date"`
	ExpiryDate  string `json:"expiry_date"`
}

type ContactBankAccount struct {
	UserID        string `json:"user_id"`
	ContactID     string `json:"contact_id"`
	BankAccountID string `json:"bank_account_id"`
	BankName      string `json:"bank_name"`
	AccountNumber string `json:"account_number"`
	AccountType   string `json:"account_type"`
	Label         string `json:"label"`
}

type ContactRelationship struct {
	UserID            string `json:"user_id"`
	ContactID         string `json:"contact_id"`
	RelatedContactID  string `json:"related_contact_id"`
	RelatedContactName string `json:"related_contact_name"`
	TypeID            string `json:"type_id"`
	TypeLabel         string `json:"type_label"`
}

type ContactOrganization struct {
	UserID           string `json:"user_id"`
	ContactID        string `json:"contact_id"`
	OrganizationID   string `json:"organization_id"`
	OrganizationName string `json:"organization_name"`
	Achievement      string `json:"achievement"`
	Date             string `json:"date"`
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
