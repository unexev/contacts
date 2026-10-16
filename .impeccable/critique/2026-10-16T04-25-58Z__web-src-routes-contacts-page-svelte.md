---
target: contacts
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-10-16T04-25-58Z
slug: web-src-routes-contacts-page-svelte
---
# Critique: contacts list (fifth run, after compact live filters, phone in rows and inactive-phone handling)

Design Health Score: 30/40 (Good). Third run at 30: the 0-4 scale hides gains inside a level; getting any criterion to 4 needs the items below.

Evidence: detector 0; browser 390px and 1280px; 45 texts, 0 contrast failures in both themes; 0 controls under 44px; every control has a focus ring; no px font sizes.

Priority issues:
- [P2] The list page has no h1: only eight letter h2 headings, so assistive tech has no page title.
- [P3] Filter panel is still 492px (58%) of an 844px phone.
- [P3] Toolbar icons have no visible labels and the row scrolls away with the list.
- [P3] Desktop content is 680px of 1280px (53%), 6 rows above the fold.
- [P3] 1.7 tab stops per row (name button plus the actions button), so keyboard users cross about two stops per contact.
