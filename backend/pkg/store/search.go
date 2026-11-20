package store

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// searchTerm is one word of a contact search. A term the user already closed
// with a space is a complete word: "mari " must not match "Marianela".
type searchTerm struct {
	Text      string
	WholeWord bool
}

// parseSearchTerms splits the raw query into terms. Only the last term, when
// followed by a space, is a whole word; earlier terms stay partial matches so
// "mar andr" still finds "María Andrade".
func parseSearchTerms(search string) []searchTerm {
	fields := strings.Fields(search)
	if len(fields) == 0 {
		return nil
	}
	lastRune, _ := utf8.DecodeLastRuneInString(search)
	endsWithSpace := unicode.IsSpace(lastRune)
	terms := make([]searchTerm, len(fields))
	for i, f := range fields {
		last := i == len(fields)-1
		terms[i] = searchTerm{Text: f, WholeWord: last && endsWithSpace}
	}
	return terms
}

// wholeWordPattern builds a case-insensitive Postgres regex (used with ~*) that
// matches the term as a complete word inside a name.
func wholeWordPattern(term string) string {
	return `(^|\s)` + regexp.QuoteMeta(term) + `(\s|$)`
}

// maxAgeFilter keeps absurd values (age:>99999999999) from building dates
// outside the representable range; no contact is that old anyway.
const maxAgeFilter = 1000

// ageFilter is an `age:` / `edad:` term: an operator ("", ">", "<", ">=", "<=")
// and a number of years.
type ageFilter struct {
	Op    string
	Value int
}

// searchPart is one `&`-separated piece of the query: an age filter or words.
// Every part must match, so `&` is an intersection.
type searchPart struct {
	Age   *ageFilter
	Terms []searchTerm
}

var ageTermPattern = regexp.MustCompile(`(?i)^(?:age|edad):(>=|<=|>|<)?(\d+)$`)

// parseSearchQuery splits the query on `&` and classifies each part. A part
// that ends with a space keeps its "whole word" meaning for its last term.
func parseSearchQuery(search string) []searchPart {
	var parts []searchPart
	for _, raw := range strings.Split(search, "&") {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		if m := ageTermPattern.FindStringSubmatch(trimmed); m != nil {
			n := maxAgeFilter
			if len(m[2]) <= 4 { // longer numbers are above the cap anyway (and may overflow)
				n, _ = strconv.Atoi(m[2])
			}
			if n > maxAgeFilter {
				n = maxAgeFilter
			}
			parts = append(parts, searchPart{Age: &ageFilter{Op: m[1], Value: n}})
			continue
		}
		parts = append(parts, searchPart{Terms: parseSearchTerms(raw)})
	}
	return parts
}

const isoBirthdate = `c.birthdate ~ '^\d{4}-\d{2}-\d{2}$'`

// ageCondition expresses "age <op> N" as a comparison of the ISO birthdate
// with dates N years back from today. Strings of that fixed format sort like
// dates, so no cast runs and a malformed value can never raise an error.
// Contacts without a valid birthdate never match, like in the mobile app.
func ageCondition(f ageFilter, today time.Time, argIdx int) (string, []any, int) {
	cutoff := func(years int) string { return today.AddDate(-years, 0, 0).Format("2006-01-02") }
	switch f.Op {
	case ">": // older than N: already had the (N+1)th birthday
		return fmt.Sprintf("(%s AND c.birthdate <= $%d)", isoBirthdate, argIdx), []any{cutoff(f.Value + 1)}, argIdx + 1
	case ">=":
		return fmt.Sprintf("(%s AND c.birthdate <= $%d)", isoBirthdate, argIdx), []any{cutoff(f.Value)}, argIdx + 1
	case "<":
		return fmt.Sprintf("(%s AND c.birthdate > $%d)", isoBirthdate, argIdx), []any{cutoff(f.Value)}, argIdx + 1
	case "<=":
		return fmt.Sprintf("(%s AND c.birthdate > $%d)", isoBirthdate, argIdx), []any{cutoff(f.Value + 1)}, argIdx + 1
	default: // exactly N: had the Nth birthday but not the (N+1)th
		return fmt.Sprintf("(%s AND c.birthdate <= $%d AND c.birthdate > $%d)", isoBirthdate, argIdx, argIdx+1),
			[]any{cutoff(f.Value), cutoff(f.Value + 1)}, argIdx + 2
	}
}

// termCondition matches one word against the name, the keywords and the
// organizations (name, achievement, date) of a contact.
func termCondition(term searchTerm, argIdx int) (string, any) {
	op, pattern := "ILIKE", "%"+term.Text+"%"
	if term.WholeWord {
		op, pattern = "~*", wholeWordPattern(term.Text)
	}
	return fmt.Sprintf(`(c.first_name %[1]s $%[2]d OR c.middle_name %[1]s $%[2]d OR c.surname %[1]s $%[2]d`+
		` OR EXISTS (SELECT 1 FROM contact_keywords ck WHERE ck.user_id = c.user_id AND ck.contact_id = c.contact_id AND COALESCE(ck.deleted, 0) = 0 AND ck.keyword %[1]s $%[2]d)`+
		` OR EXISTS (SELECT 1 FROM contact_organizations co JOIN organizations o ON o.organization_id = co.organization_id`+
		` WHERE co.user_id = c.user_id AND co.contact_id = c.contact_id AND COALESCE(co.deleted, 0) = 0`+
		` AND (o.name %[1]s $%[2]d OR co.achievement %[1]s $%[2]d OR co.date %[1]s $%[2]d)))`, op, argIdx), pattern
}

// searchConditions turns the raw search box text into WHERE conditions (all
// ANDed) and their arguments, numbering placeholders from argIdx.
func searchConditions(search string, today time.Time, argIdx int) (clauses []string, args []any, next int) {
	for _, part := range parseSearchQuery(search) {
		if part.Age != nil {
			clause, a, n := ageCondition(*part.Age, today, argIdx)
			clauses, args, argIdx = append(clauses, clause), append(args, a...), n
			continue
		}
		for _, term := range part.Terms {
			clause, arg := termCondition(term, argIdx)
			clauses, args = append(clauses, clause), append(args, arg)
			argIdx++
		}
	}
	return clauses, args, argIdx
}
