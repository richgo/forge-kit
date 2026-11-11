# Product requirements

Copy the [Markdown requirements template](../blueprint/product-requirements.md)
into the project. Start with an epic and its outcome. Nest the features that
advance that outcome and the stories that make each feature observable.
Give every epic, feature, story and acceptance criterion a stable ID. Each
story names its architecture owner and describes the actor, need and benefit.
Write each acceptance criterion with Given, When and Then, and add a
`Check:` reference to the independent check that verifies it.

Use the [request template](../blueprint/request.md) to select the approved
story IDs and list the exact source paths the candidate may change. Record
implementation constraints there. Keep the product behavior and acceptance
criteria in `product-requirements.md`. Review and commit both files to the
project. The hosted factory reads them from the selected workspace on the
default branch. [Hosted workflow](apmx-factory.md#run-in-github-actions)

The approved project owns the checker, its test fixtures and the expected
results. The factory passes the selected stories' distinct check IDs to
`.forge/verify-change` with the unapplied patch. In the quote API, the
`quote.acceptance` check exercises a normal discount, a discount that
would bring the total below zero, and invalid input. [Quote API requirements](../examples/consumers/python-api/product-requirements.md)

## Trace a story through the readiness fixture

The [readiness example](../examples/product-requirements.md) links
`STORY-001` to the `health_probe` CALM node. Its check references
resolve against [acceptance.json](../examples/acceptance.json), which
supplies the executable action and exact standard output and exit-code
assertions.

Install the pinned APM dependencies, then stage the approved requirements,
assertions and delegated architecture in a fresh input directory.

```sh
apm install --target copilot --frozen
mkdir -p out/story-inputs
cp examples/product-requirements.md examples/acceptance.json out/story-inputs/
cp test/fixtures/delegated/architecture.json test/fixtures/delegated/architecture.c4 out/story-inputs/
node factory/cli.mjs run out/story --inputs out/story-inputs --story STORY-001 --fault wrong-output-once
node factory/cli.mjs verify out/story --inputs out/story-inputs --story STORY-001
node factory/cli.mjs requirements-evidence out/story --inputs out/story-inputs --story STORY-001 > out/story/requirements-verification.json
```

The plan and in-toto statement trace the epic, feature, story, CALM owner
and acceptance IDs. The fixture checks the LikeC4 projection, rejects the
faulty candidate, rebuilds and independently replays the deployed artifact.
The resulting report records the approved Markdown and assertion digests,
the compiled requirements digest and the deployed artifact digest. The CI
checker reads the approved inputs from its own checkout.

## Verify with APMX

Use the `packages.skills` reference from `node factory/cli.mjs assemble`.
In a fresh workspace outside the Git checkout, copy the approved
`product-requirements.md` and `acceptance.json` alongside the checked
`plan.json`, `receipt.json` and `deployed.mjs` from the fixture run.

```sh
apmx --from 'richgo/forge-kit-skills/packages/requirements#<reviewed-commit-sha>' --plan
apmx --from 'richgo/forge-kit-skills/packages/requirements#<reviewed-commit-sha>'
```

The independent APMX checker recomputes the report from the approved
inputs and compares its trace, artifact digest and recorded runtime
observations. The local in-toto statement is unsigned. Hosted replay and
attestation evidence applies to the workflow revision that produced it.
