package noteval

import (
	"strings"
	"testing"
)

func TestValidateNoteLength_WithinLimit(t *testing.T) {
	note := strings.Repeat("a", MaxNoteLength)
	if err := ValidateNoteLength(note); err != nil {
		t.Fatalf("expected 500-char note to be valid, got error: %v", err)
	}
}

func TestValidateNoteLength_ExceedsLimit(t *testing.T) {
	note := strings.Repeat("a", MaxNoteLength+1)
	if err := ValidateNoteLength(note); err == nil {
		t.Fatal("expected 501-char note to be rejected")
	}
}

func TestValidateNoteLength_MultibyteRunesCountedAsOne(t *testing.T) {
	// "é" and "😀" are each a single rune but take multiple bytes in UTF-8.
	note := strings.Repeat("é", MaxNoteLength-1) + "😀"
	if err := ValidateNoteLength(note); err != nil {
		t.Fatalf("expected %d multibyte runes to be valid, got error: %v", MaxNoteLength, err)
	}
	tooLong := note + "x"
	if err := ValidateNoteLength(tooLong); err == nil {
		t.Fatal("expected note with 501 multibyte runes to be rejected")
	}
}

func TestNormalizeNote_TrimsBeforeChecking(t *testing.T) {
	padded := "  " + strings.Repeat("a", MaxNoteLength) + "  "
	trimmed := NormalizeNote(padded)
	if err := ValidateNoteLength(trimmed); err != nil {
		t.Fatalf("expected trimmed 500-char note to be valid, got error: %v", err)
	}
}

func TestValidateNoteCount_WithinLimit(t *testing.T) {
	if err := ValidateNoteCount(MaxNotesPerContact - 1); err != nil {
		t.Fatalf("expected 10th note (9 existing) to be allowed, got error: %v", err)
	}
}

func TestValidateNoteCount_ExceedsLimit(t *testing.T) {
	if err := ValidateNoteCount(MaxNotesPerContact); err == nil {
		t.Fatal("expected 11th note (10 existing) to be rejected")
	}
}
