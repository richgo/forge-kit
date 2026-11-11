# Approved change request

## Stories

- `STORY-101`
- `STORY-102`
- `STORY-103`

## Allowed source paths

- `src/index.html`
- `src/server.mjs`
- `src/catalog.json`

## Constraints

Serve the trail catalog as JSON at the same-origin `GET /api/v1/trails` route.
Render the catalog from that response in the browser. Preserve the approved
product requirements, catalog fields and order, step-free filtering, and
distance sorting. Keep the architecture owner `trail_catalog`.
