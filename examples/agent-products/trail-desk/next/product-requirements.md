# Product requirements

## Epic EPIC-101 — Plan a day outdoors

Outcome: Visitors can select trails that suit their visit.

### Feature FEAT-101 — Trail catalog

Outcome: Visitors can browse a supplied trail catalog.

#### Story STORY-101 — Browse the trail catalog

Architecture owner: `trail_cli`, `trail_catalog`

A trail visitor browses a supplied catalog. Read one JSON request object from stdin with a trails array. Every row must be an object with a unique nonempty string id, a positive safe-integer distanceMeters, and a boolean stepFree. Return exactly {"trails":[...]} with the ordered trail IDs, retaining input order by default and allowing an empty catalog. Use src/main.mjs for the Node stdlib stdin/stdout boundary and src/catalog.mjs for catalog validation and selection. Emit exactly one JSON value to stdout and exit successfully for every valid JSON request, including rejected requests.

##### Acceptance AC-101 — Browse in catalog order

- Given the supplied catalog lists Fern, Ridge, and Lake in that order.
- When the visitor requests the catalog.
- Then the result lists Fern, Ridge, and Lake in catalog order.
- Check: `ac-101`

##### Acceptance AC-102 — Browse an empty catalog

- Given the supplied catalog is empty.
- When the visitor requests the catalog.
- Then the result contains an empty trail list.
- Check: `ac-102`

### Feature FEAT-102 — Step-free trail filter

Outcome: Visitors can find step-free trails.

#### Story STORY-102 — Filter for step-free trails

Architecture owner: `trail_cli`, `trail_catalog`

A trail visitor can limit results to step-free trails by including stepFreeOnly:true. Missing stepFreeOnly or false keeps all trails. Return exactly {"error":"INVALID_REQUEST"} if the request is not an object, trails is missing or invalid, a row is invalid or repeated, or the optional stepFreeOnly value is not a boolean. Validate every row before filtering.

##### Acceptance AC-103 — Show step-free trails

- Given the supplied catalog has step-free Fern and Lake trails and a Ridge trail with steps.
- When the visitor enables the step-free filter.
- Then the result lists Fern and Lake in catalog order.
- Check: `ac-103`

##### Acceptance AC-104 — Show every trail when filtering is off

- Given the supplied catalog has an Oak trail with steps and a step-free Pine trail.
- When the visitor sets the step-free filter to false.
- Then the result lists Oak and Pine in catalog order.
- Check: `ac-104`

##### Acceptance AC-105 — Reject duplicate trails before filtering

- Given the supplied catalog contains two rows with the same trail ID.
- When the visitor enables the step-free filter.
- Then the request returns `INVALID_REQUEST`.
- Check: `ac-105`

### Feature FEAT-103 — Distance ordering

Outcome: Visitors can compare trails by distance.

#### Story STORY-103 — Order trails by distance

Architecture owner: `trail_cli`, `trail_catalog`, `distance_order`

A trail visitor can add an optional sort value of catalog, shortest, or longest. Missing sort or catalog preserves input order. Shortest and longest sort numerically by distanceMeters after applying the step-free filter, with ties retaining input order in both directions. An unsupported sort value returns exactly {"error":"INVALID_REQUEST"}. Put ordering logic in a new src/distance.mjs module and preserve all existing browse and accessibility behavior.

##### Acceptance AC-106 — Show shortest trails first

- Given the supplied catalog has Fern at 2.1 km, Ridge at 5.8 km, and Lake at 3.4 km.
- When the visitor sorts shortest first.
- Then the result lists Fern, Lake, and Ridge in ascending distance order.
- Check: `ac-106`

##### Acceptance AC-107 — Keep catalog order for ties when filtering and sorting

- Given the supplied catalog has Oak and Birch at equal distances, a longer step-free Alder trail, and a longer Pine trail with steps.
- When the visitor enables the step-free filter and sorts longest first.
- Then the result lists Alder, Oak, and Birch, with Oak preceding Birch as in the catalog.
- Check: `ac-107`

##### Acceptance AC-108 — Reject an unsupported sort

- Given the supplied catalog is valid.
- When the visitor requests random sorting.
- Then the request returns `INVALID_REQUEST`.
- Check: `ac-108`
