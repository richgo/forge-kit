# Product requirements

An epic states the desired outcome. A feature describes a capability that
advances it. A story names the actor, the need, the benefit and the owning
component. Give each acceptance criterion a stable ID and an observable
Given, When and Then. Keep those IDs in the change request, the independent
checks and the review evidence.

## Write a change request

Copy the [request template](../blueprint/request.md) or read the
[quote API example](../examples/consumers/python-api/request.md). Record
the outcome, permitted paths, protected interfaces and behavior, and any
affected architecture model. For the discount story, an acceptance check
can start with a subtotal of 100, apply a discount of 30 and expect a total
of 70. A second case can verify that a discount greater than the subtotal
returns zero. The independent tests belong to the approved project base.

## Trace a story through the readiness fixture

The [structured product example](../examples/product-requirements.json)
uses a CALM owner and stable acceptance IDs. Its `run-readiness-probe`
action checks exact standard output and exit code. The executable
assertions live in `then`. The `given` field records the review context.

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
