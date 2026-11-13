package store

import (
	"regexp"
	"strings"
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
