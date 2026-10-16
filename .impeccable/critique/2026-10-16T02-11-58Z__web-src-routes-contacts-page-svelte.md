---
target: contacts
total_score: 27
p0_count: 0
p1_count: 0
timestamp: 2026-10-16T02-11-58Z
slug: web-src-routes-contacts-page-svelte
---
# Critique: contacts list (re-run after P1 and P2 fixes)

Design Health Score: 27/40 (Acceptable, was 23). Visibility 3, Real world 3, Control 3, Consistency 3, Error prevention 3, Recognition 2, Flexibility 2, Minimalist 3, Error recovery 3, Help 2.

Detector: 0 findings.

Priority issues:
- [P2] White text on the blue badges (10-11px) is 3.65:1, below the AA target for small text.
- [P2] The refresh button gives no feedback, and background page loading is invisible.
- [P2] Sort and filters still reset on reload; the list still cannot start a call or message from a row.
- [P3] Empty state ignores active filters; letter headers are not sticky and there is no letter index.
