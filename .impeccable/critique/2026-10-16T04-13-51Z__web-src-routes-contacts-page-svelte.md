---
target: contacts
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-10-16T04-13-51Z
slug: web-src-routes-contacts-page-svelte
---
# Critique: contacts list (fourth run, after toolbar move, creation-time sort and error states)

Design Health Score: 30/40 (Good, unchanged). Every heuristic at 3; the remaining gaps are structural.

Evidence: detector 0 findings; browser at 390px and 1280px; contrast 0 failures in list and filter panel, light and dark.

Priority issues:
- [P2] The filter panel is 751px tall on an 844px phone (89% of the screen): 16 chips in 5 groups plus an Apply step; a chip tap does not filter live.
- [P2] Rows show only the name; the primary phone is in the payload but not visible, so the user cannot see which number the menu will use.
- [P3] The toolbar row, now sharing a line with the first letter, scrolls away with the list; its icons have no visible label; no result count.
- [P3] Desktop uses a 680px column of 1280px; 6 rows above the fold.
