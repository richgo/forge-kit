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

```sh
export FORGE_ARCHITECTURE_PACKAGE=/path/to/forge-kit-skills/packages/architecture
node examples/openspec-checkout/qualify.mjs
```

The rehearsal requires Git, Node and Python 3. It creates temporary real Git repositories, validates the shared OpenSpec change and the flat CALM/LikeC4 model, and executes the old and repaired Python API and Node consumer. It checks the same story in monorepo, multi-repo and hybrid layouts. It also checks rejection of an incompatible API and stale plan evidence, then verifies rollback after an injected rollout failure.

The reference uses local build and deployment adapters and digest receipts. Hosted cross-repository APMX dispatch, signed aggregation, coordinated deployment against live services, automatic OpenSpec sync/archive and protected post-deployment knowledge promotion still require integration and qualification. Native APMX receipt replay and historic signed brownfield evidence are tested separately.
