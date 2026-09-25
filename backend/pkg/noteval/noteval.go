// Package noteval provides pure validation rules for contact notes:
// a maximum note length and a maximum number of notes per contact.
package noteval

import (
	"errors"
	"strings"
	"unicode/utf8"
)

const (
	// MaxNoteLength is the maximum number of runes allowed in a single note.
	MaxNoteLength = 500
	// MaxNotesPerContact is the maximum number of non-deleted notes a contact may have.
	MaxNotesPerContact = 10
)

// ErrNoteTooLong is returned when a note exceeds MaxNoteLength runes.
var ErrNoteTooLong = errors.New("note exceeds the maximum of 500 characters")

// ErrTooManyNotes is returned when a contact already has MaxNotesPerContact notes.
var ErrTooManyNotes = errors.New("contact already has the maximum of 10 notes")

// NormalizeNote trims leading/trailing whitespace before validation or storage.
func NormalizeNote(note string) string {
	return strings.TrimSpace(note)
}

// ValidateNoteLength counts runes (not bytes) so multibyte characters are
// counted as a single character each.
func ValidateNoteLength(note string) error {
	if utf8.RuneCountInString(note) > MaxNoteLength {
		return ErrNoteTooLong
	}
	return nil
}

// ValidateNoteCount checks the count of existing (non-deleted) notes on a
// contact before allowing one more to be created.
func ValidateNoteCount(existingCount int) error {
	if existingCount >= MaxNotesPerContact {
		return ErrTooManyNotes
	}
	return nil
}
