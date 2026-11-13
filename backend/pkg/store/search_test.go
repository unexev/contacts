package store

import (
	"reflect"
	"testing"
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
