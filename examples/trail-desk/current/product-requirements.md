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

### Feature FEAT-103 — Distance sorting

Outcome: Visitors can find a trail that fits the time they have.

#### Story STORY-103 — Sort trails by walking distance

Architecture owner: `distance_sort`

As a trail visitor, I want to sort trails by distance with or without the step-free filter so that I can compare the routes that fit my time and access needs.

##### Acceptance AC-104 — Show shortest trails first

- Given all trails are visible.
- When the visitor sorts shortest first.
- Then the visible trails are Fern Loop, Mirror Lake, Juniper Ridge, in that order.
- Check: `ac-104`

##### Acceptance AC-105 — Show longest trails first

- Given all trails are visible.
- When the visitor sorts longest first.
- Then the visible trails are Juniper Ridge, Mirror Lake, Fern Loop, in that order.
- Check: `ac-105`

##### Acceptance AC-106 — Sort step-free trails by descending distance

- Given the step-free filter is active.
- When the visitor sorts longest first.
- Then the visible trails are Mirror Lake, Fern Loop, in that order.
- Check: `ac-106`

##### Acceptance AC-107 — Restore catalog order

- Given the longest-first sort is active.
- When the visitor resets the sort.
- Then the visible trails are Fern Loop, Juniper Ridge, Mirror Lake, in that order.
- Check: `ac-107`
