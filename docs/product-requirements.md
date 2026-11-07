# Product requirements

Start with the [product example](../examples/product-requirements.json) or the
authoring and JSON templates in the pinned Forge Kit Skills requirements
package. An epic states an outcome. A feature describes a capability that
advances that outcome. A story names its actor, need, benefit, and owning CALM
node. Acceptance criteria use stable IDs and Given, When, Then fields.

This reference runs one selected story per invocation. The supported action,
`run-readiness-probe`, checks the program's exact standard output and exit
code. The executable assertions live in `then`. The `given` field records
fixture context for the reviewer. New behavior needs a corresponding
executable checker before it can be accepted as a story.

## Run and verify

Install the pinned APM dependencies, then create a fresh working directory.

```sh
apm install --target copilot --frozen
mkdir -p out/story-inputs
cp examples/product-requirements.json test/fixtures/delegated/architecture.json test/fixtures/delegated/architecture.c4 out/story-inputs/
node factory/cli.mjs run out/story --inputs out/story-inputs --story STORY-001 --fault wrong-output-once
node factory/cli.mjs verify out/story --inputs out/story-inputs --story STORY-001
node factory/cli.mjs requirements-evidence out/story --inputs out/story-inputs --story STORY-001 > out/story/requirements-verification.json
```

The factory records the Epic → Feature → Story → acceptance IDs in the plan
and in-toto Statement. It checks the story's CALM owner and LikeC4 projection,
rejects the bad candidate, rebuilds, and independently replays the deployed
artifact against the selected criteria. The separate CI checker uses the
approved requirements and architecture from its own checkout.

## Verify with APMX

Use the `packages.skills` reference from `node factory/cli.mjs assemble`.
In a fresh non-Git workspace, copy the approved `product-requirements.json`
and the independently checked `plan.json`, `receipt.json` and
`deployed.mjs`. Run the pinned package with APMX.

```sh
apmx --from 'richgo/forge-kit-skills/packages/requirements#<reviewed-commit-sha>' --plan
apmx --from 'richgo/forge-kit-skills/packages/requirements#<reviewed-commit-sha>'
```

APMX verifies the report against the approved product document, plan,
deployed artifact digest and recorded runtime observations. CI resolves the
contract in APMX and runs its declared checker without a model. The local
in-toto Statement is unsigned. The checker validates traceability and
consistency of the evidence produced by the independent replay.

The previous flat readiness fixture remains available for existing CLI
examples and tests.
