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
- [x] T7 Web: organization editor uses `Combobox` for organization name (select existing or create) and for achievement/title (suggestions from T6), labeled date, no internal IDs shown (route: delegated writer). Commit b0d32d7.
- [x] T8a Web: remove non-functional file import from `/sync` (route: inline). Commit 68cc272.
- [x] T8b Web copy: remove import/restore claims (landing sync feature, Free plan "VCF import", `syncDesc`, `menuSyncDesc`) and drop unused i18n keys (`syncImport*`, `locationEmpty`, `nationalityEmpty`) (route: delegated writer, with T10). Commit 6bff20b.
- [x] T9 Backend: organizations scoped per user (migration 008: `organizations.user_id`, UNIQUE(user_id, name), copy shared orgs per using user and remap `contact_organizations`, delete unused), all org queries filtered by session user, with tests (route: delegated writer, after T10). Commit fdd1b6b.
- [x] T10 Web: `/offline` landing for the separate offline app ("Contacts Offline": Android + Windows/macOS/Linux, local SQLite, optional Google Drive backup), download buttons as "Coming soon", explicit notice that apps are independent (separate accounts/data, no sync); short teaser block on the main landing linking to `/offline` (route: delegated writer; trigger: 2+ non-trivial files). Commit 395ed11.

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

- T8b committed: 6bff20b — landing `landingFeatSyncTitle/Desc` now describe export only ("Exportar"/"Export",
  "Descarga una copia de tus contactos cuando quieras."/"Download a copy of your contacts anytime.");
  icon changed `RefreshCw` -> `Download` in `+page.svelte`. Free plan feature "Importar contactos
  VCF"/"VCF contact import" -> "Exportar tus contactos"/"Export your contacts". `syncDesc` ->
  "Exporta una copia de tus contactos en cualquier momento."/"Export a copy of your contacts
  anytime." `menuSyncDesc` (used to say "restore") -> "Exporta y gestiona tus contactos"/"Export
  and manage your contacts". Removed unused keys `syncImport`, `syncImportVcf`, `syncImported`,
  `locationEmpty`, `nationalityEmpty` from both `es`/`en` after confirming with `rg` that none are
  referenced anywhere in `web/src`. `npm run build` clean, no new warnings.
- T10 committed: 395ed11 — new route `web/src/routes/offline/+page.svelte`: nav (brand "Contacts
  Offline" + link back to `/` labeled "Contacts (web)"/"Contacts (web)" + language toggle), hero,
  an independence notice (lucide `Info` icon, not a glyph) stating the two apps have separate
  accounts/data and do not sync, a 6-card feature grid (local SQLite storage, Google Drive backup
  limited to 2 copies, birthday notifications, advanced search filters, VCF import, documents &
  bank accounts), a downloads section with 4 platform cards (Android/Windows/macOS/Linux) built
  from a `platforms` array with `url: null`; each renders as a non-link `<span>` with
  `aria-disabled="true"` and a "Coming soon" badge — flip `url` to a real link later and the
  `{#if p.url}` branch renders an `<a>` instead. Icons: `HardDrive`, `Cloud`, `Bell`, `Search`,
  `FileUp`, `IdCard` for features; `Smartphone`, `Monitor`, `Laptop`, `Terminal` for platforms
  (no brand logos, per lucide availability). `web/src/routes/+layout.svelte`: `/offline` added to
  the bare-route list so it gets no app nav and full-width `<main>`, same as `/`; it does not
  redirect logged-in users (no `onMount` auth check, unlike `/`). Main landing
  (`web/src/routes/+page.svelte`): added a "Offline app" nav link (hidden on phones, same as the
  other nav links) and a short teaser section after pricing, before the final CTA, linking to
  `/offline`; no offline-app content mixed into the pricing plans. All new strings added to both
  `es` and `en` in `i18n.svelte.js`. No price is shown or implied for Contacts Offline. `npm run
  build` clean, no new warnings (pre-existing unused-CSS-selector and a11y warnings in
  `contacts/[id]/+page.svelte` are unrelated to this task and were not introduced by it).
- `rg -n "syncImport|locationEmpty|nationalityEmpty" web/src` returns no results.

- T9 committed: fdd1b6b — migration `008_organizations_per_user.sql`: adds
  `organizations.user_id`, drops the old global `UNIQUE(name)` constraint
  *before* backfilling (dropping it after caused a duplicate-name violation
  when creating copies — found and fixed via the real-DB run below), backfills
  the keeper (MIN user_id per organization_id from `contact_organizations`),
  creates a same-name copy for every other referencing user via a
  `ON COMMIT DROP` temp table and remaps their `contact_organizations` rows to
  it, deletes organizations left with no `user_id` (never referenced by
  anyone), sets `user_id NOT NULL`, and adds `UNIQUE(user_id, name)` +
  `idx_organizations_user`. Guarded with `IF NOT EXISTS`/`WHERE user_id IS
  NULL`/`WHERE co.user_id <> o.user_id` so a second run is a no-op (verified).
  `pkg/orgscope` extracts the pure, unit-tested logic: `Owns(orgUserID,
  requestingUserID)` (ownership check) and `Plan([]UserOrg) []Assignment`
  (keeper/copy planning mirroring the SQL rule) — RED (undefined `Owns`/
  `Plan`/`UserOrg`/`Assignment`) then GREEN (9 passed: single-user, two-user,
  three-user, duplicate-pair-dedup, multi-org, empty-input cases).
  Store: `ListOrganizationsByUser` now queries `organizations WHERE user_id =
  $1` directly instead of joining through `contact_organizations` (so a
  created-but-not-yet-linked org shows up too). `CreateOrganizationForUser`
  upserts on `(user_id, name)` (`ON CONFLICT ... DO UPDATE ... RETURNING`),
  returning the existing organization instead of erroring on a duplicate name
  for the same user (previously this had no duplicate handling at all — a
  second insert with the same name would have hit the then-global
  `UNIQUE(name)` and failed with a 500). `CreateOrganization` (linking a
  contact to an org) now looks up the org's owner and rejects with the new
  `store.ErrOrganizationNotOwned` (mapped to HTTP 400 "organization not
  found" in `app.go`) unless it belongs to the requesting user; this also
  closes the previous dead/risky fallback that generated a brand-new
  `organization_id` when the request omitted one (which would have hit an FK
  violation) — an empty/unowned id is now rejected cleanly instead.
  `cmd/migrate-sqlite` now sets `user_id` when importing organizations (it
  would otherwise violate the new `NOT NULL`). `cmd/cleanup` now also clears
  the `organizations` table (it's per-user data now, not a shared catalog).
  `cmd/fix-schema` only introspects a hardcoded table list for printing and
  doesn't touch organizations' structure — left unchanged.
  API contract for `GET`/`POST /api/organizations` unchanged
  (`{organization_id, name}`).
  Real-DB verification: `docker compose up -d` (Postgres on 5433), throwaway
  `contacts_t9`/`contacts_t9b` databases (both dropped after, `docker compose
  down` without `-v` so the real `pgdata` volume/data was untouched). Fresh-DB
  run via `cmd/migrate`: clean, and re-running it again was a no-op. Seeded
  run: applied migrations 001-007 by hand, seeded two users (`usr_alice`,
  `usr_bob`) sharing one organization (`org_shared01`/"Acme Corp") plus one
  unused organization (`org_unused1`/"Ghost Inc"), then ran `cmd/migrate`
  (which applies 001-008; 001-007 no-op). First attempt failed with
  `duplicate key value violates unique constraint "organizations_name_key"`
  — the bug described above — fixed by moving the constraint drop earlier;
  re-seeded and reran clean. `psql` verification: `usr_alice` (alphabetically
  smaller) kept `org_shared01` unchanged; `usr_bob` got a new copy
  (`org_a0f086467f2847c7`, same name) and his `contact_organizations` row was
  remapped to it; `org_unused1` was gone; `organizations` had exactly
  `PRIMARY KEY(organization_id)`, `UNIQUE(user_id, name)`, and
  `idx_organizations_user`, `user_id NOT NULL`, and the FK from
  `contact_organizations` was intact. Re-ran `cmd/migrate` again on this
  now-migrated DB: still exactly 2 organization rows (idempotent, confirmed).
- `go vet ./...`, `go test ./...` (30 passed, 17 packages), `go build ./...`
  all pass as of T9.

## Next step
T4 Playwright verification at 375px (not run by this writer — out of scope for T8b/T10/T9).
All other tasks done.
