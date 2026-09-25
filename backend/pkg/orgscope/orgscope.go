// Package orgscope holds the pure ownership and migration-planning logic
// behind scoping organizations per user (migration 008). Organizations used
// to be a single global catalog shared by every user; this package documents
// and tests, independently of any database, the two decisions that scoping
// them per user requires:
//
//   - Owns: whether a given user may read, link to, or modify an
//     organization owned by another user (they may not).
//   - Plan: for a legacy organization referenced by more than one user,
//     which user keeps the original row and which other users need their
//     own copy, so their contact_organizations links can be remapped.
//
// Migration 008 implements the same rule in SQL; these pure functions exist
// so the rule itself has unit test coverage without a live Postgres.
package orgscope

import "sort"

// Owns reports whether requestingUserID may use an organization owned by
// orgUserID. Organizations are single-tenant: only their owner may read,
// link a contact to, or modify them. An organization with no owner
// (orgUserID == "") is owned by nobody.
func Owns(orgUserID, requestingUserID string) bool {
	return orgUserID != "" && orgUserID == requestingUserID
}

// UserOrg is one observed (user, organization) reference, typically derived
// from a distinct row of contact_organizations.
type UserOrg struct {
	UserID         string
	OrganizationID string
}

// Assignment describes how one legacy, potentially shared, organization
// should be split among its users: Keeper keeps the original organization
// row, and every user in Copies needs their own copy (same name, new id)
// with their contact_organizations links remapped to it.
type Assignment struct {
	OrganizationID string
	Keeper         string
	Copies         []string
}

// Plan groups distinct (user, organization) pairs by organization and
// decides, for each one, which user keeps the original row. The keeper is
// the smallest user_id (MIN), a deterministic tie-break so the plan (and
// migration 008, which implements the same rule in SQL) produce a stable
// result. Every other user referencing the organization appears in Copies,
// sorted for determinism. Duplicate pairs are deduped. Assignments are
// returned sorted by OrganizationID.
func Plan(pairs []UserOrg) []Assignment {
	usersByOrg := make(map[string]map[string]struct{})
	var orgOrder []string
	for _, p := range pairs {
		users, ok := usersByOrg[p.OrganizationID]
		if !ok {
			users = make(map[string]struct{})
			usersByOrg[p.OrganizationID] = users
			orgOrder = append(orgOrder, p.OrganizationID)
		}
		users[p.UserID] = struct{}{}
	}

	assignments := make([]Assignment, 0, len(orgOrder))
	for orgID, users := range usersByOrg {
		all := make([]string, 0, len(users))
		for u := range users {
			all = append(all, u)
		}
		sort.Strings(all)

		keeper := all[0]
		var copies []string
		if len(all) > 1 {
			copies = append(copies, all[1:]...)
		}

		assignments = append(assignments, Assignment{
			OrganizationID: orgID,
			Keeper:         keeper,
			Copies:         copies,
		})
	}

	sort.Slice(assignments, func(i, j int) bool {
		return assignments[i].OrganizationID < assignments[j].OrganizationID
	})

	return assignments
}
