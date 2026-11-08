# Architecture and product change impact

Run the planner from the repository root. It reads the before and after product requirements, validates each CALM and LikeC4 pair and prints a deterministic JSON plan.

## Tracked Trail Desk changes

Omit the model flags to generate both models for that requirements snapshot using the same builder as the release website.

```sh
node factory/impact.mjs \
  --before-requirements examples/trail-desk/baseline/product-requirements.json \
  --after-requirements examples/trail-desk/step-free/product-requirements.json
```

The plan adds the `step_free_filter` CALM node and two relationships. The architecture scope includes `browser`, `step_free_filter` and `visitor`. The acceptance scope contains `STORY-102`, `AC-102` and `AC-103`. To plan the distance sorting release, compare `step-free` with `current`. To plan a removal, swap the two requirements paths and inspect `acceptanceRemoved`.

## Authored architecture changes

Give both model paths for each authored snapshot. The same flags accept model files written by a website release.

```sh
node factory/impact.mjs \
  --before-requirements examples/product-requirements.json \
  --before-calm architecture/slice.json \
  --before-likec4 architecture/slice.c4 \
  --after-requirements examples/product-requirements.json \
  --after-calm test/fixtures/delegated/architecture.json \
  --after-likec4 test/fixtures/delegated/architecture.c4
```

The readiness story stays unchanged while the architecture adds a worker and delegation. The plan includes both live criteria for `STORY-001`, `AC-001` and `AC-002`.

## Reading the plan

- `changes` lists added, removed and changed IDs. Relationships also show before and after endpoints. Requirement and architecture records are compared by ID, so reordering declarations does not create changes. The order of values within a requirement, such as the expected order of trail cards, still matters.
- `architectureSeeds` includes edited nodes and the old and new sources of edited relationships. The source is the consumer whose dependency changed. The destination is shown in the relationship change and enters the scope if another rule reaches it.
- `architectureConsumers` follows incoming dependency edges from the seeds in each snapshot. The closure includes the seeds present in that snapshot and all transitive consumers. Separate snapshots preserve dependencies that existed before a removal.
- `stories` lists stable story IDs, their before and after CALM owners and the reasons each story is in scope. An architecture, story, epic or feature change includes all current criteria for affected stories. A criterion-only edit includes the changed criterion. Changes to shared top-level product fields, such as `trails`, include all stories.
- `acceptanceToRun` contains current criterion IDs. `acceptanceRemoved` records criteria that disappeared from the requirements.

## Input boundaries and verification

The planner accepts version 1 product requirements with unique tracked `EPIC-*`, `FEAT-*`, `STORY-*` and `AC-*` IDs and a CALM owner for each story. Model generation supports the tracked Trail Desk builder. Other products can supply authored model pairs.

The supported architecture format is the factory's flat CALM 1.2 projection. CALM nodes have IDs, types, names and descriptions. Relationships are directed node-level `connects` records with optional descriptions. The matching LikeC4 source has element declarations, a flat model and one named `include *` view. Topologies with interfaces, nesting, other relationship types or filtered views require a broader planner. An unsupported shape, dangling reference or projection mismatch exits nonzero and emits no plan.

The planner uses declared dependencies to select acceptance checks. The JSON is planning evidence. The independent acceptance runner verifies behavior, and the full release gate determines promotion.

```sh
node --test test/impact.test.mjs
```

The tests cover tracked Trail Desk and readiness inputs, transitive and cyclic dependencies, removals, acceptance-only changes, shared product data, view renames, stable ordering and rejection of invalid inputs.

## Native architecture regression checks

Run `bash factory/test/native-architecture.sh` with Node.js and npm. It uses
the pinned FINOS CLI to verify both readiness topologies and rejects a
disconnected multi-node model. The policy permits the upstream
`architecture-nodes-must-be-referenced` warning for one standalone service.
GitHub PR preview also checks the generated website snapshots with native
CALM and LikeC4 and publishes both impact reports.

A changed acceptance criterion scopes that criterion plus the acceptance
checks of downstream consumers. The planner keeps requirement seeds
separate from direct CALM edits.
