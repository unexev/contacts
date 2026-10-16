---
target: contacts
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-10-16T02-28-18Z
slug: web-src-routes-contacts-page-svelte
---
# Critique: contacts list (third run, after quick actions, persistence, P3 and calendar work)

Design Health Score: 30/40 (Good, was 27). Every heuristic at 3: no 4 yet because filters still need an Apply step, there is no undo, the row hides the phone number and wide screens use a single column.

Evidence: detector 0 findings; browser checked at 390px light, 390px dark and 1280px light; contrast measured on tokens.

Priority issues:
- [P2] Row does not show the phone, so the user cannot see which number a call or WhatsApp will use (primary_phone is already in the payload).
- [P2] Filters: 5 groups with 16 chips and an Apply step; far above the 4-option limit and not live like search.
- [P3] Desktop: one 680px column with only a name per row; width and density unused.
- [P3] Toolbar icons have no visible label; focus ring on the first menu item is heavy.
