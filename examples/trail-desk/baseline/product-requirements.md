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
