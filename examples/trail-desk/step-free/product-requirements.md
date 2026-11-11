# Product requirements

## Epic EPIC-101 — Plan a day outdoors

Outcome: Visitors can choose a trail before leaving home.

### Feature FEAT-101 — Trail catalog

Outcome: Visitors can compare trails at a glance.

#### Story STORY-101 — Browse the trail catalog

Architecture owner: `trail_catalog`

As a trail visitor, I want to see every available trail so that I can choose a trail that suits my visit.

##### Acceptance AC-101 — Show every published trail

- Given the catalog is published.
- When the visitor opens the catalog.
- Then the visible trails are Fern Loop, Juniper Ridge, Mirror Lake, in that order.
- Check: `ac-101`

### Feature FEAT-102 — Step-free trail filter

Outcome: Visitors can quickly find step-free routes.

#### Story STORY-102 — Filter for step-free trails

Architecture owner: `step_free_filter`

As a trail visitor, I want to show only step-free options and clear the filter so that I can choose a trail that suits my visit.

##### Acceptance AC-102 — Show only step-free trails

- Given all trails are visible.
- When the visitor turns on the step-free filter.
- Then the visible trails are Fern Loop, Mirror Lake, in that order.
- Check: `ac-102`

##### Acceptance AC-103 — Restore the full catalog

- Given the step-free filter is active.
- When the visitor clears the step-free filter.
- Then the visible trails are Fern Loop, Juniper Ridge, Mirror Lake, in that order.
- Check: `ac-103`
