package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	dbPath := os.Getenv("SQLITE_DB")
	pgURL := os.Getenv("DATABASE_URL")
	email := os.Getenv("USER_EMAIL")
	password := os.Getenv("USER_PASSWORD")
	userID := os.Getenv("USER_ID")

	if dbPath == "" || pgURL == "" || (userID == "" && (email == "" || password == "")) {
		log.Fatal("Set SQLITE_DB, DATABASE_URL and either USER_ID or USER_EMAIL/USER_PASSWORD")
	}

	fmt.Println("=== Migration ===")

	sqlite, err := sql.Open("sqlite3", dbPath+"?mode=ro")
	if err != nil {
		log.Fatalf("sqlite: %v", err)
	}
	defer sqlite.Close()

	ctx := context.Background()
	cfg, _ := pgxpool.ParseConfig(pgURL)
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, _ := pgxpool.NewWithConfig(ctx, cfg)
	defer pool.Close()

	if userID == "" {
		// Create a user only when the migration is run as an import.
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		userID = fmt.Sprintf("usr_%d", time.Now().UnixNano()%0xFFFFFFFF)
		_, err = pool.Exec(ctx,
			`INSERT INTO app_users (user_id, email, name, password_hash, role, status, created_at)
			 VALUES ($1, $2, $3, $4, 'user', 'active', $5)`,
			userID, email, email, string(hash), time.Now().UnixMilli())
		if err != nil {
			log.Fatalf("user: %v", err)
		}
	} else if os.Getenv("REPLACE_EXISTING") == "1" {
		// Remove only this user's records; catalogs remain shared and untouched.
		for _, table := range []string{
			"contact_organizations", "contact_relationships", "contact_bank_accounts",
			"identity_cards", "contact_keywords", "contact_notes", "contact_urls",
			"contact_emails", "contact_phones", "contacts",
		} {
			if _, err = pool.Exec(ctx, "DELETE FROM "+table+" WHERE user_id = $1", userID); err != nil {
				log.Fatalf("clear %s: %v", table, err)
			}
		}
	}
	fmt.Printf("User: %s\n", userID)

	contactMap := make(map[string]string)

	// Contacts
	rows, _ := sqlite.Query("SELECT contact_id, first_name, middle_name, surname, birthdate, gender, status_id FROM contact")
	count := 0
	for rows.Next() {
		var oldID, fn, mn, sn string
		var bd, gn, si sql.NullString
		rows.Scan(&oldID, &fn, &mn, &sn, &bd, &gn, &si)
		nid := fmt.Sprintf("cnt_%d", time.Now().UnixNano()%0xFFFFFFFF)
		contactMap[oldID] = nid
		time.Sleep(time.Millisecond)
		_, _ = pool.Exec(ctx,
			`INSERT INTO contacts VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0)`,
			userID, nid, fn, mn, sn, nullStr(bd), nullStr(gn), nullStr(si), time.Now().UnixMilli())
		count++
		if count%100 == 0 {
			fmt.Printf("  contacts: %d\n", count)
		}
	}
	rows.Close()
	fmt.Printf("Contacts: %d\n", count)

	// Organizations and their contact links
	orgRows, _ := sqlite.Query("SELECT organization_id, name FROM organization")
	orgCount := 0
	for orgRows.Next() {
		var oid, name string
		orgRows.Scan(&oid, &name)
		_, _ = pool.Exec(ctx, `INSERT INTO organizations (organization_id, name) VALUES ($1, $2) ON CONFLICT (organization_id) DO NOTHING`, oid, name)
		orgCount++
	}
	orgRows.Close()
	fmt.Printf("Organizations: %d\n", orgCount)

	coRows, _ := sqlite.Query("SELECT contact_id, organization_id, achievement, date FROM contact_organization")
	coCount := 0
	for coRows.Next() {
		var cid, oid, achievement string
		var date sql.NullString
		coRows.Scan(&cid, &oid, &achievement, &date)
		if nc, ok := contactMap[cid]; ok {
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_organizations (user_id, contact_id, organization_id, achievement, date, updated_at, deleted)
				 VALUES ($1, $2, $3, $4, $5, $6, 0) ON CONFLICT DO NOTHING`,
				userID, nc, oid, achievement, nullStr(date), time.Now().UnixMilli())
			coCount++
		}
	}
	coRows.Close()
	fmt.Printf("Contact organizations: %d\n", coCount)

	// Keywords
	kwRows, _ := sqlite.Query("SELECT contact_id, keyword FROM contact_keyword")
	kwCount := 0
	for kwRows.Next() {
		var cid, keyword string
		kwRows.Scan(&cid, &keyword)
		if nc, ok := contactMap[cid]; ok {
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_keywords (user_id, contact_id, keyword, updated_at, deleted)
				 VALUES ($1, $2, $3, $4, 0) ON CONFLICT DO NOTHING`,
				userID, nc, keyword, time.Now().UnixMilli())
			kwCount++
		}
	}
	kwRows.Close()
	fmt.Printf("Keywords: %d\n", kwCount)

	// Phones
	phRows, _ := sqlite.Query("SELECT contact_id, phone, label FROM contact_phone")
	phCount := 0
	for phRows.Next() {
		var cid, ph string
		var lb sql.NullString
		phRows.Scan(&cid, &ph, &lb)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_phones VALUES ($1,$2,$3,$4,$5,0)`,
				userID, nc, fmt.Sprintf("phn_%d", time.Now().UnixNano()%0xFFFFFFFF), ph, nullStr(lb))
			phCount++
		}
	}
	phRows.Close()
	fmt.Printf("Phones: %d\n", phCount)

	// Emails
	emRows, _ := sqlite.Query("SELECT contact_id, email, label FROM contact_email")
	emCount := 0
	for emRows.Next() {
		var cid, em string
		var lb sql.NullString
		emRows.Scan(&cid, &em, &lb)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_emails VALUES ($1,$2,$3,$4,$5,0)`,
				userID, nc, fmt.Sprintf("eml_%d", time.Now().UnixNano()%0xFFFFFFFF), em, nullStr(lb))
			emCount++
		}
	}
	emRows.Close()
	fmt.Printf("Emails: %d\n", emCount)

	// Notes
	ntRows, _ := sqlite.Query("SELECT contact_id, note FROM contact_note")
	ntCount := 0
	for ntRows.Next() {
		var cid, nt string
		ntRows.Scan(&cid, &nt)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_notes VALUES ($1,$2,$3,$4,$5,0)`,
				userID, nc, fmt.Sprintf("nte_%d", time.Now().UnixNano()%0xFFFFFFFF), nt, time.Now().UnixMilli())
			ntCount++
		}
	}
	ntRows.Close()
	fmt.Printf("Notes: %d\n", ntCount)

	// URLs
	urRows, _ := sqlite.Query("SELECT contact_id, url, label FROM contact_url")
	urCount := 0
	for urRows.Next() {
		var cid, ur string
		var lb sql.NullString
		urRows.Scan(&cid, &ur, &lb)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_urls VALUES ($1,$2,$3,$4,$5,0)`,
				userID, nc, fmt.Sprintf("url_%d", time.Now().UnixNano()%0xFFFFFFFF), ur, nullStr(lb))
			urCount++
		}
	}
	urRows.Close()
	fmt.Printf("URLs: %d\n", urCount)

	// Cards
	crRows, _ := sqlite.Query("SELECT contact_id, doc_type, card_number, issue_date, expiry_date FROM national_identity_card")
	crCount := 0
	for crRows.Next() {
		var cid, dt, cn string
		var id, ed sql.NullString
		crRows.Scan(&cid, &dt, &cn, &id, &ed)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO identity_cards VALUES ($1,$2,$3,$4,$5,$6,$7,0)`,
				userID, nc, fmt.Sprintf("crd_%d", time.Now().UnixNano()%0xFFFFFFFF), dt, cn, nullStr(id), nullStr(ed))
			crCount++
		}
	}
	crRows.Close()
	fmt.Printf("Cards: %d\n", crCount)

	// Banks
	baRows, _ := sqlite.Query("SELECT contact_id, bank_name, account_number, account_type, label FROM contact_bank_account")
	baCount := 0
	for baRows.Next() {
		var cid, an string
		var bn, at, lb sql.NullString
		baRows.Scan(&cid, &bn, &an, &at, &lb)
		if nc, ok := contactMap[cid]; ok {
			time.Sleep(time.Millisecond)
			_, _ = pool.Exec(ctx,
				`INSERT INTO contact_bank_accounts VALUES ($1,$2,$3,$4,$5,$6,$7,0)`,
				userID, nc, fmt.Sprintf("bak_%d", time.Now().UnixNano()%0xFFFFFFFF), nullStr(bn), an, nullStr(at), nullStr(lb))
			baCount++
		}
	}
	baRows.Close()
	fmt.Printf("Banks: %d\n", baCount)

	// Relationships
	reRows, _ := sqlite.Query("SELECT contact_id, related_contact_id, type_id FROM contact_relationship")
	reCount := 0
	for reRows.Next() {
		var cid, rid, tid string
		reRows.Scan(&cid, &rid, &tid)
		if nc, ok := contactMap[cid]; ok {
			if nr, ok2 := contactMap[rid]; ok2 {
				time.Sleep(time.Millisecond)
				_, _ = pool.Exec(ctx,
					`INSERT INTO contact_relationships VALUES ($1,$2,$3,$4,0)`,
					userID, nc, nr, tid)
				reCount++
			}
		}
	}
	reRows.Close()
	fmt.Printf("Relationships: %d\n", reCount)

	fmt.Printf("\nLogin: %s / %s\n", email, password)
}

func nullStr(s sql.NullString) interface{} {
	if s.Valid {
		return s.String
	}
	return nil
}
