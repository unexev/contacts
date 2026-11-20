package store

import (
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestParseSearchTerms(t *testing.T) {
	cases := []struct {
		in   string
		want []searchTerm
	}{
		{"", nil},
		{"   ", nil},
		{"mari", []searchTerm{{Text: "mari"}}},
		{"mari ", []searchTerm{{Text: "mari", WholeWord: true}}},
		{"  mari  lop", []searchTerm{{Text: "mari"}, {Text: "lop"}}},
		{"mar andr", []searchTerm{{Text: "mar"}, {Text: "andr"}}},
		{"là", []searchTerm{{Text: "là"}}},
		{"là ", []searchTerm{{Text: "là", WholeWord: true}}},
		{"mari lopez ", []searchTerm{{Text: "mari"}, {Text: "lopez", WholeWord: true}}},
	}
	for _, c := range cases {
		got := parseSearchTerms(c.in)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("parseSearchTerms(%q) = %#v, want %#v", c.in, got, c.want)
		}
	}
}

func TestWholeWordPattern(t *testing.T) {
	if got, want := wholeWordPattern("mari"), `(^|\s)mari(\s|$)`; got != want {
		t.Errorf("wholeWordPattern(mari) = %q, want %q", got, want)
	}
	// Regex metacharacters typed by the user are matched literally.
	if got, want := wholeWordPattern("a.b"), `(^|\s)a\.b(\s|$)`; got != want {
		t.Errorf("wholeWordPattern(a.b) = %q, want %q", got, want)
	}
}

func TestParseSearchQuery(t *testing.T) {
	cases := []struct {
		in   string
		want []searchPart
	}{
		{"", nil},
		{" & & ", nil},
		{"ana", []searchPart{{Terms: []searchTerm{{Text: "ana"}}}}},
		{"age:23", []searchPart{{Age: &ageFilter{Op: "", Value: 23}}}},
		{"EDAD:>=30", []searchPart{{Age: &ageFilter{Op: ">=", Value: 30}}}},
		{"age:<18", []searchPart{{Age: &ageFilter{Op: "<", Value: 18}}}},
		{"ana & age:>30", []searchPart{
			{Terms: []searchTerm{{Text: "ana", WholeWord: true}}},
			{Age: &ageFilter{Op: ">", Value: 30}},
		}},
		{"vip & acme", []searchPart{
			{Terms: []searchTerm{{Text: "vip", WholeWord: true}}},
			{Terms: []searchTerm{{Text: "acme"}}},
		}},
		// Not a valid age term: stays a plain word.
		{"age:abc", []searchPart{{Terms: []searchTerm{{Text: "age:abc"}}}}},
		{"age:99999999999999999999", []searchPart{{Age: &ageFilter{Op: "", Value: maxAgeFilter}}}},
	}
	for _, c := range cases {
		got := parseSearchQuery(c.in)
		if !reflect.DeepEqual(got, c.want) {
			t.Errorf("parseSearchQuery(%q) = %#v, want %#v", c.in, got, c.want)
		}
	}
}

func TestAgeCondition(t *testing.T) {
	today := time.Date(2026, time.November, 20, 0, 0, 0, 0, time.UTC)
	cases := []struct {
		f        ageFilter
		wantArgs []any
	}{
		{ageFilter{">", 30}, []any{"1995-11-20"}},  // 31 or older: born on/before 1995-11-20
		{ageFilter{">=", 30}, []any{"1996-11-20"}}, // 30 or older
		{ageFilter{"<", 18}, []any{"2008-11-20"}},  // under 18: born after 2008-11-20
		{ageFilter{"<=", 18}, []any{"2007-11-20"}}, // 18 or younger: born after 2007-11-20
		{ageFilter{"", 23}, []any{"2003-11-20", "2002-11-20"}},
	}
	for _, c := range cases {
		clause, args, next := ageCondition(c.f, today, 5)
		if !reflect.DeepEqual(args, c.wantArgs) {
			t.Errorf("%+v: args = %v, want %v", c.f, args, c.wantArgs)
		}
		if next != 5+len(c.wantArgs) {
			t.Errorf("%+v: next = %d", c.f, next)
		}
		if !strings.Contains(clause, isoBirthdate) {
			t.Errorf("%+v: clause must guard against malformed birthdates: %s", c.f, clause)
		}
	}
}

func TestSearchConditionsNumbersPlaceholdersAndJoinsParts(t *testing.T) {
	today := time.Date(2026, time.November, 20, 0, 0, 0, 0, time.UTC)
	clauses, args, next := searchConditions("ana lop & edad:23", today, 3)
	// two words + one exact-age filter (two bounds)
	if len(clauses) != 3 || len(args) != 4 || next != 7 {
		t.Fatalf("clauses=%d args=%d next=%d", len(clauses), len(args), next)
	}
	if !strings.Contains(clauses[0], "$3") || !strings.Contains(clauses[1], "$4") {
		t.Errorf("word placeholders not numbered from 3: %v", clauses[:2])
	}
	if !strings.Contains(clauses[2], "$5") || !strings.Contains(clauses[2], "$6") {
		t.Errorf("age placeholders wrong: %s", clauses[2])
	}
	if args[0] != "%ana%" {
		t.Errorf("first arg = %v", args[0])
	}
}

func TestTermConditionSearchesOrganizations(t *testing.T) {
	clause, arg := termCondition(searchTerm{Text: "acme"}, 2)
	for _, want := range []string{"o.name ILIKE $2", "co.achievement ILIKE $2", "co.date ILIKE $2", "ck.keyword ILIKE $2"} {
		if !strings.Contains(clause, want) {
			t.Errorf("clause missing %q", want)
		}
	}
	if arg != "%acme%" {
		t.Errorf("arg = %v", arg)
	}
	clause, arg = termCondition(searchTerm{Text: "acme", WholeWord: true}, 2)
	if !strings.Contains(clause, "o.name ~* $2") || arg != `(^|\s)acme(\s|$)` {
		t.Errorf("whole word not applied: %s %v", clause, arg)
	}
}
