package orgscope

import "testing"

func TestOwns_SameUserOwnsIt(t *testing.T) {
	if !Owns("usr_1", "usr_1") {
		t.Fatal("expected owner to own their own organization")
	}
}

func TestOwns_DifferentUserDoesNotOwnIt(t *testing.T) {
	if Owns("usr_1", "usr_2") {
		t.Fatal("expected a different user to not own the organization")
	}
}

func TestOwns_UnassignedOrganizationIsOwnedByNobody(t *testing.T) {
	if Owns("", "usr_1") {
		t.Fatal("expected an organization with no owner to be unowned")
	}
}

func TestPlan_SingleUserKeepsTheirOwnOrganization(t *testing.T) {
	got := Plan([]UserOrg{
		{UserID: "usr_2", OrganizationID: "org_a"},
	})
	want := []Assignment{
		{OrganizationID: "org_a", Keeper: "usr_2", Copies: nil},
	}
	assertAssignments(t, got, want)
}

func TestPlan_SharedOrganizationKeeperIsMinUserID(t *testing.T) {
	got := Plan([]UserOrg{
		{UserID: "usr_9", OrganizationID: "org_a"},
		{UserID: "usr_2", OrganizationID: "org_a"},
	})
	want := []Assignment{
		{OrganizationID: "org_a", Keeper: "usr_2", Copies: []string{"usr_9"}},
	}
	assertAssignments(t, got, want)
}

func TestPlan_ThreeUsersSharingOneOrganization(t *testing.T) {
	got := Plan([]UserOrg{
		{UserID: "usr_c", OrganizationID: "org_a"},
		{UserID: "usr_a", OrganizationID: "org_a"},
		{UserID: "usr_b", OrganizationID: "org_a"},
	})
	want := []Assignment{
		{OrganizationID: "org_a", Keeper: "usr_a", Copies: []string{"usr_b", "usr_c"}},
	}
	assertAssignments(t, got, want)
}

func TestPlan_DuplicatePairsAreDeduped(t *testing.T) {
	got := Plan([]UserOrg{
		{UserID: "usr_1", OrganizationID: "org_a"},
		{UserID: "usr_1", OrganizationID: "org_a"},
		{UserID: "usr_2", OrganizationID: "org_a"},
		{UserID: "usr_2", OrganizationID: "org_a"},
	})
	want := []Assignment{
		{OrganizationID: "org_a", Keeper: "usr_1", Copies: []string{"usr_2"}},
	}
	assertAssignments(t, got, want)
}

func TestPlan_MultipleOrganizationsAreIndependentAndSortedByID(t *testing.T) {
	got := Plan([]UserOrg{
		{UserID: "usr_2", OrganizationID: "org_b"},
		{UserID: "usr_1", OrganizationID: "org_b"},
		{UserID: "usr_5", OrganizationID: "org_a"},
	})
	want := []Assignment{
		{OrganizationID: "org_a", Keeper: "usr_5", Copies: nil},
		{OrganizationID: "org_b", Keeper: "usr_1", Copies: []string{"usr_2"}},
	}
	assertAssignments(t, got, want)
}

func TestPlan_EmptyInputReturnsEmpty(t *testing.T) {
	got := Plan(nil)
	if len(got) != 0 {
		t.Fatalf("expected no assignments, got %v", got)
	}
}

func assertAssignments(t *testing.T, got, want []Assignment) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("length mismatch: got %+v, want %+v", got, want)
	}
	for i := range got {
		g, w := got[i], want[i]
		if g.OrganizationID != w.OrganizationID || g.Keeper != w.Keeper {
			t.Fatalf("index %d: got %+v, want %+v", i, g, w)
		}
		if len(g.Copies) != len(w.Copies) {
			t.Fatalf("index %d copies length: got %v, want %v", i, g.Copies, w.Copies)
		}
		for j := range g.Copies {
			if g.Copies[j] != w.Copies[j] {
				t.Fatalf("index %d copy %d: got %q, want %q", i, j, g.Copies[j], w.Copies[j])
			}
		}
	}
}
