# ForgeKit reference checkout

The reference checkout links a reviewed OpenSpec change to the existing product, epic, feature and story hierarchy. The example uses a shared response contract, a Python API and a Node consumer. See [the requirements](../examples/openspec-checkout/specs/product-requirements.md) and [the OpenSpec change](../examples/openspec-checkout/openspec/changes/update-checkout/proposal.md).

## Author and verify an OpenSpec change

Install the locked OpenSpec 2.0.0 toolchain from a ForgeKit checkout using Node 22.22.2 or later and run the upstream initializer in the consumer.

```sh
npm --prefix toolchain/openspec ci --ignore-scripts --engine-strict
node toolchain/openspec/node_modules/@fission-ai/openspec/bin/openspec.js init /path/to/consumer --tools github-copilot,codex --no-copilot-cloud
node bin/forgekit.mjs openspec validate --workspace /path/to/consumer
```

Use the generated OpenSpec skills to draft the proposal, tasks, and specification deltas. Commit the reviewed change and a [binding](../examples/openspec-checkout/.forge/openspec.json) that maps every acceptance ID selected by `request.md` to a named scenario. The hosted APMX workflow validates the change before handing it to the agent. The versioned skills verifier rechecks selected stories, paths and scenario references from the reviewed checkout during independent replay. An optional reviewed baseline checker lets APMX record the expected pre-change failure separately from the passing candidate check.

## Plan across repositories

`planProductChange` accepts a versioned `ProductChange` manifest and reviewed inputs. The manifest names the shared specification repository, OpenSpec change, commit and artifact digest. Each implementation unit names a CALM component, story IDs, owning team, child change, repository, path, immutable source revision and build target. Deployable units also specify a deployment unit.

Source paths and CALM connections select impacted consumers. Explicit `requires` edges determine build and release order. The planner rejects overlapping paths and different baselines in one repository, unknown dependencies, dependency cycles and conflicting package pins. Units sharing a commit retain individual build and evidence identities. The catalog selects per-stack and mandatory package references with digests. Production adapters must install and audit these pins before executing builds.

`verifyProductChange` accepts adapters for builds, independent unit verification, reuse of unchanged units, and whole-system verification. Each receipt binds a unit, baseline, plan and artifact. The system candidate contains every unit, including authenticated unchanged baselines. Architecture conformance, API compatibility and system acceptance must pass against the candidate digest.

`releaseProductChange` requires an authentication adapter and deploys in dependency order after reading rollback baselines. Deployment and rollback adapters receive the expected current artifact so they can enforce compare-and-swap. Failed readiness triggers reverse-order recovery and verification of restored artifacts. A recovery failure returns partial status.

## Reproduce the reference

To plan a reviewed product change from files, run:

```sh
node factory/plan-product-change.mjs --manifest product-change.json \
  --calm architecture/system.calm.json --likec4 architecture/system.c4 \
  --capabilities catalog.json > plan.json
```

On the protected default branch, the **APMX product unit** workflow can build
one affected unit from the reviewed plan. Its target repository and revision
come from that plan. In each child workspace, commit the local OpenSpec
binding, the shared specification object as `.forge/shared-change.json`,
and the shared validation command's `sha256` inventory as
`.forge/shared-specification.json`. Hash the inventory's compact JSON to
set `specification.sha256` in the manifest. Shared deltas must have the same
bytes in the child. For private repositories, configure a read-only
`FORGEKIT_TARGET_READ_TOKEN` for the target. The producer receives the
existing agent credential. The workflow delivers a signed bundle for review.

Download the delivery and receipt from each unit's run. Use
`factory/authenticate-product-unit.mjs` with the reviewed plan, unit ID,
receipt file, delivery directory and exact orchestration source commit and
ref. It verifies the pinned workflow signer, then checks the target revision,
package, independent acceptance and delivered bytes against the signed
receipt. The workflow takes one unit per run because upstream APMX 0.8.0
assigns fixed artifact names inside a run.

Run `node factory/qualify-product-change.mjs --plan plan.json --adapter adapter.mjs` with the reviewed plan
and a trusted local `adapter.mjs` module to assemble the candidate and
run the system checks. The module exports `createAdapters(plan)` and
supplies the build and verification adapters described above.

```sh
export FORGE_ARCHITECTURE_PACKAGE=/path/to/forge-kit-skills/packages/architecture
node examples/openspec-checkout/qualify.mjs
```

The rehearsal requires Git, Node and Python 3. It creates temporary real Git repositories, validates the shared OpenSpec change and the flat CALM/LikeC4 model, and executes the old and repaired Python API and Node consumer. It checks the same story in monorepo, multi-repo and hybrid layouts. It also checks rejection of an incompatible API and stale plan evidence, then verifies rollback after an injected rollout failure.

To run the three-repository case through native APMX, set `FORGE_REFERENCE_APMX`
to the path to APMX 0.8.0 on Linux, with the Copilot CLI available on
PATH. This mode uses a recorded producer patch and an independent
APMX replay for each repository. Set `FORGE_REFERENCE_EVIDENCE` to a fresh
directory to keep the locally replayed receipts.

The reference uses local rollout adapters. Automatic orchestration of the
hosted unit workflow, signing the assembled system candidate, coordinated
deployment against live services, automatic OpenSpec sync/archive and
protected post-deployment knowledge promotion still require integration and
qualification.

The [hosted plan](../examples/openspec-checkout/hosted/plan.json) pins the
three synthetic GitHub repositories. The reference workflow fetches their
exact commits and replays recorded producer patches through native APMX.
On main, a separate job attests the system qualification and each independently
checked receipt. This attestation covers the deterministic rehearsal. The
product-unit workflow uses a live agent and publishes its own APMX attestation.
