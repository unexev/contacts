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
- [ ] T6 Backend: `GET /api/organizations/achievements` returning the user's distinct non-empty achievements, with tests (route: delegated writer).
- [ ] T7 Web: organization editor uses `Combobox` for organization name (select existing or create) and for achievement/title (suggestions from T6), labeled date, no internal IDs shown (route: delegated writer).

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

## Next step
T6-T7 organization combobox (delegated writer), then T4 Playwright verification.
