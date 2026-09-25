# Feature: data-limits

## Objective
Protect the 500 MB Postgres budget and data quality by limiting contact notes and validating identity document numbers per country.

## Problem / Why
- `contact_notes` has no length or count limit: a single user can inflate storage without bound.
- `identity_cards.card_number` accepts any string; an Ecuadorian cédula must be exactly 10 digits with a valid check digit.
- Identity cards have no country, so validation cannot scale to other countries' documents.

## Scope
- Notes: max 500 characters per note, max 10 notes per contact. Enforced in the backend (source of truth) and mirrored in the web form.
- Identity documents: add nullable `country_code` to `identity_cards` (migration 007). Validation is a registry keyed by (country_code, doc_type) so new countries are added as new rules.
  - First rule: `EC` + `national_id` = 10 digits, province 01-24 or 30, third digit < 6, modulo-10 check digit.
  - Documents without a country or without a matching rule keep current behavior (no strict validation).
- Web form: country selector on each document, `maxlength`/inline errors, i18n (es/en).

## Out of scope
- Plan system (Free/Pro) and the 5,000-contact Pro cap enforcement.

## Constraints
- TDD: Strict TDD mode enabled (session config). Runner: `go test ./...` in `backend/`. Web has no test runner: verify with `npm run build` + Playwright.
- Artifacts in English. Conventional commits, no AI attribution.

## Tasks
- [x] T0 Landing page + pricing, login moved to `/login` (route: inline). Commit 6c8d1e0.
- [x] T1 Backend: note limits (500 chars, 10 per contact) with tests (route: delegated writer; trigger: 2+ non-trivial files). Commit 6d5a02c.
- [x] T2 Backend: migration 007 `identity_cards.country_code` + document validation registry + EC cédula rule, with tests (route: delegated writer). Commit bed78ff.
- [x] T3 Web: note limits in form, document country selector, inline validation, i18n (route: delegated writer). Commit a409d15.
- [ ] T4 Verification: `go test ./...`, `go vet ./...`, `npm run build`, Playwright check at 375px. Parent spot check done: go vet clean, 16 tests passed, build clean.
- [x] T5 Web: hide empty location/nationality sections on contact detail; they are reachable from the "Add" menu (route: inline, mechanical).
- [x] T6 Backend: `GET /api/organizations/achievements` returning the user's distinct non-empty achievements, with tests (route: delegated writer). Commit 16ab4ef.
- [x] T7 Web: organization editor uses `Combobox` for organization name (select existing or create) and for achievement/title (suggestions from T6), labeled date, no internal IDs shown (route: delegated writer). Commit: see git log.

## Acceptance criteria
- API rejects a note > 500 chars and an 11th note on a contact with a clear 400 error.
- API rejects an EC national_id that is not a valid cédula; accepts a valid one (e.g. `1710034065`).
- Existing documents without country still load and save.
- Form prevents typing > 500 chars and shows errors from the API.

## Progress / Evidence
- T0 committed: 6c8d1e0 on `feat/landing-and-data-limits`.
- T1 committed: 6d5a02c — `backend/pkg/noteval` (pure, rune-counted 500-char limit; 10 notes/contact),
  wired into `createNote`/`updateNote`. Tests RED (undefined symbols) then GREEN (6 passed).
  No functional VCF/sync import path exists in the backend (the `/sync` page's file import
  handler is a UI-only stub that never calls the API), so nothing else writes notes.
- T2 committed: bed78ff — migration `007_identity_card_country.sql` (`ADD COLUMN IF NOT EXISTS`),
  `IdentityCard.CountryCode`, store read/write threaded, `backend/pkg/docvalidate` registry
  keyed by (country_code, doc_type) with the EC `national_id` rule (10 digits, province 01-24/30,
  third digit < 6, modulo-10 check digit) and a generic 30-char max length for unmatched
  country/doc-type pairs. Tests RED then GREEN (10 passed).
- T3 committed: see hash below — note `maxlength=500` + live counter + disabled "add" at 10 notes;
  per-document country selector (`web/src/lib/countries.js`, empty = none); EC national_id gets
  `inputmode="numeric"`, `maxlength=10`, and inline validation via a new
  `web/src/lib/docValidation.js` registry mirroring the Go rule exactly. `api.svelte.js` now
  surfaces the backend's actual `error` message on HTTP 400 instead of a generic string, so API
  error messages (note/document limits, invalid cédula) reach the form's existing error banner.
  All new strings added to both `es` and `en` in `i18n.svelte.js`. `npm run build` clean, no
  warnings.
- `go vet ./...`, `go test ./...` (16 passed, 15 packages), `go build ./...`, and
  `npm run build` all pass as of T3.
- Left as pre-existing, untouched, out of scope: an already-modified
  `web/src/routes/contacts/[id]/+page.svelte` (empty-section hiding for locations/nationalities)
  and an untracked `web/src/lib/components/Combobox.svelte`, both present in the working tree
  before this writer started and not authored by this task.

- T6 committed: 16ab4ef — `GET /api/organizations/achievements` (optional `organizationId` query
  param scopes to one organization); pure ranking (trim, drop empty, dedupe exact match, order by
  frequency desc then alphabetical, cap 200) extracted into `backend/pkg/achievements` and unit
  tested (RED: undefined `Rank`/`MaxResults`; GREEN: 5 passed). Store's `ListAchievementsByUser`
  reads raw achievements from non-deleted `contact_organizations` for the user (optionally filtered
  by organization) and calls `achievements.Rank`. Route registered before the existing `/organizations`
  GET/POST; no `/organizations/{id}` route exists so there is no collision either way.
- T7 committed: see hash below — edit form's organization section now uses two `Combobox` instances
  (existing untracked `web/src/lib/components/Combobox.svelte`, reviewed and used as-is: no bugs
  found) bound to `organization_name` and `achievement`, plus a labeled (visible label, not just
  `title`) date input. Achievements are loaded once on mount via
  `api('/api/organizations/achievements').catch(() => [])` alongside the other lookups. On
  organization-name change, `organization_id` is set to the matching org (accent/case-insensitive,
  matching Combobox's own NFD-based normalization) or cleared to `''`; `resolveOrganizations()` at
  save time does the same match-or-create and now also appends newly created organizations to
  `availableOrgs`. Removed the old `__new`/`newName` select-based path entirely (dead code in
  `addOrganization`, `resolveOrganizations`, `saveOrganizations`, markup) and the internal
  `organization_id.slice(0,12)` fragment shown to the user. `contacts/new/+page.svelte` has no
  organization UI, so nothing to change there. CSS: added `.related-item.org-item { overflow:
  visible; }` so the item container no longer clips the Combobox's absolutely-positioned dropdown;
  reworked `.org-grid` mobile-first (base: stacked single column, `@media (min-width: 640px)`
  widens to a 4-column row) instead of the file's pre-existing `max-width` pattern, and removed the
  now-dead `.org-extra`/`.org-extra-label` rules and the org-specific bits of the two pre-existing
  `max-width` blocks (left untouched for `nationality-grid`, which this task did not touch). All new
  strings (`organizationHint`, `organizationNameLabel`, `organizationNamePlaceholder`,
  `organizationAchievementLabel`, `organizationAchievementPlaceholder`, `organizationDateLabel`,
  `comboboxCreate`) added to both `es` and `en` in `i18n.svelte.js`. `npm run build` clean, no
  warnings.
- `go vet ./...`, `go test ./...` (21 passed, 16 packages), `go build ./...`, and `npm run build`
  all pass as of T7.

## Next step
T4 Playwright verification at 375px (not run by this writer — out of scope for T6/T7).
