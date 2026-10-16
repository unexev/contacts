---
target: contacts
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-10-16T02-08-17Z
slug: web-src-routes-contacts-page-svelte
---
# Critique: contacts list (web/src/routes/contacts/+page.svelte)

Design Health Score: 23/40 (Acceptable). Visibility 2, Real world 2, Control 3, Consistency 3, Error prevention 3, Recognition 2, Flexibility 2, Minimalist 3, Error recovery 1, Help 2.

Anti-patterns verdict: not AI slop; reads as a familiar iOS-style tool. Detector: 0 findings (CSS tokens live in vars, so contrast was checked manually).

Priority issues:
- [P1] A failed load renders as "no contacts" (catch sets contacts to []), no error, no retry.
- [P1] Mixed languages: filters, sort, toolbar titles and chips in English; rest of app in Spanish.
- [P1] Contrast below the WCAG AA target: ghost button accent on Pale Slate 2.91:1, placeholder 4.16:1 light / 4.27:1 dark, active tab label 3.65:1 at 11px.
- [P2] 600 contacts in a flat list with no letter headers; list renders only after every page is fetched sequentially.
- [P2] FAB "+" has no accessible name; filter chips have no aria-pressed; skeleton aria-label reuses "Guardando".

Personas: Alex (no quick call/WhatsApp from the row, no keyboard path), Casey (icon-only toolbar with title-only hints, sort and filters reset on reload), Sam (contrast, chip state by color only).
