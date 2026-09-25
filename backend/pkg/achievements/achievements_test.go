package achievements

import (
	"strconv"
	"testing"
)

func TestRank_TrimsAndDropsEmpty(t *testing.T) {
	got := Rank([]string{"  Bachiller  ", "", "   ", "Ingeniero"})
	want := []string{"Bachiller", "Ingeniero"}
	assertEqual(t, got, want)
}

func TestRank_DedupesExactMatches(t *testing.T) {
	got := Rank([]string{"Bachiller", "Bachiller", "Ingeniero"})
	want := []string{"Bachiller", "Ingeniero"}
	assertEqual(t, got, want)
}

func TestRank_OrdersByFrequencyDescThenAlphabetical(t *testing.T) {
	got := Rank([]string{"Ingeniero", "Bachiller", "Bachiller", "Master", "Bachiller", "Doctor", "Doctor"})
	want := []string{"Bachiller", "Doctor", "Ingeniero", "Master"}
	assertEqual(t, got, want)
}

func TestRank_LimitsTo200(t *testing.T) {
	raw := make([]string, 0, 250)
	for i := 0; i < 250; i++ {
		raw = append(raw, "achievement-"+strconv.Itoa(i))
	}
	got := Rank(raw)
	if len(got) != MaxResults {
		t.Fatalf("expected %d results, got %d", MaxResults, len(got))
	}
}

func TestRank_EmptyInputReturnsEmpty(t *testing.T) {
	got := Rank(nil)
	if len(got) != 0 {
		t.Fatalf("expected no results, got %v", got)
	}
}

func assertEqual(t *testing.T, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("length mismatch: got %v, want %v", got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("index %d: got %q, want %q (full got=%v want=%v)", i, got[i], want[i], got, want)
		}
	}
}
