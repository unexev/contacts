// Package achievements provides pure ranking logic for the distinct
// achievement/title values a user has recorded across their contacts'
// organizations, used to power search-and-create suggestions in the UI.
package achievements

import (
	"sort"
	"strings"
)

// MaxResults caps the number of achievement suggestions returned.
const MaxResults = 200

// Rank trims whitespace, drops empty values, deduplicates exact matches,
// and orders the remaining achievements by descending frequency, then
// ascending alphabetical order, returning at most MaxResults values.
func Rank(raw []string) []string {
	counts := make(map[string]int, len(raw))
	order := make([]string, 0, len(raw))
	for _, v := range raw {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, seen := counts[v]; !seen {
			order = append(order, v)
		}
		counts[v]++
	}

	sort.SliceStable(order, func(i, j int) bool {
		if counts[order[i]] != counts[order[j]] {
			return counts[order[i]] > counts[order[j]]
		}
		return order[i] < order[j]
	})

	if len(order) > MaxResults {
		order = order[:MaxResults]
	}
	return order
}
