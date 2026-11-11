# Trail Desk change rehearsals

Both rehearsals stage the current Trail Desk catalog, sorting and step-free
filtering as the approved base for a local HTTP app. Each request limits the
source paths available to the producer. Chromium checks the patched app in a
separate process against the approved project inputs.

| Change | Approved input | Independent checks |
| --- | --- | --- |
| Show distances in miles | [Request](miles/request.md) and [new story](miles/story.md) | Kilometers remain the default. Miles display to one decimal place. Switching units preserves ordering and the step-free filter. |
| Serve the catalog over HTTP | [Request](catalog-api/request.md) and [CALM and LikeC4 changes](catalog-api/architecture.mjs) | The browser reads the same-origin GET endpoint at /api/v1/trails. An intercepted response changes the rendered cards. All seven approved catalog, filter and sort criteria are replayed against the same Markdown requirements. |

## Run both rehearsals

Use Bash, Git, Node.js, the [pinned APM capabilities](../../../docs/components.md#package-trust)
and Playwright with Chromium. From the repository root, run the deterministic
candidates against a fresh copy of the base.

```sh
apm install --target copilot --frozen
npm install --prefix out/trail-tools playwright@1.56.1
out/trail-tools/node_modules/.bin/playwright install chromium
export FORGE_PLAYWRIGHT="$(realpath out/trail-tools/node_modules/playwright/index.mjs)"
node scripts/rehearse-trail-desk.mjs rehearse miles out/trail-miles
node scripts/rehearse-trail-desk.mjs rehearse catalog-api out/trail-api
```

Each output directory contains the approved workspace, the candidate source
and its unapplied Git patch. The checks print the observed acceptance
results. The bootstrap workflow records both sets of observations in the
Trail Desk preview artifact.

## Run through APMX

Use the prepare command with either rehearsal name and a new output directory.
Enter the staged workspace and follow the [APMX runbook](../../../docs/apmx-factory.md)
to plan and execute the reviewed request. For independent replay, prepare
another fresh workspace for the same rehearsal and use the receipt from the
first run with the same pinned package. Keep FORGE_PLAYWRIGHT set for both
workspaces.

```sh
node scripts/rehearse-trail-desk.mjs prepare catalog-api out/trail-api-apmx
cd out/trail-api-apmx
```
