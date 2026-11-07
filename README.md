# Forge Kit

Forge Kit is a reference software factory assembled from external APM packages. It includes a deterministic lifecycle fixture, an APMX package rehearsal, and a caller for the catalog's reusable GitHub Agentic Workflow. The local fixture runs offline with Node.js 20 or later.

## Run the slice

See [factory verification and evals](docs/testing.md) for architecture-change scenarios, injected faults, rollback, and grading.

See [product requirements](docs/product-requirements.md) for the Epic → Feature → Story template, executable acceptance criteria, and APMX verification.

```sh
node --test
node factory/cli.mjs assemble
mkdir out
node factory/cli.mjs run out/clean
node factory/cli.mjs verify out/clean
node factory/cli.mjs run out/repaired --faulty-first-build
node factory/cli.mjs verify out/repaired
```

Use a fresh output directory for each run. The fixture starts with a readiness requirement and a checked-in FINOS CALM architecture. It checks the corresponding LikeC4 view, writes a plan, builds a small Node program, checks its exact behavior, copies the accepted artifact to a local deployment path, and invokes it to observe readiness. A deliberately faulty build demonstrates one repair attempt. Exhaustion or failed observation stops the run.

The in-toto Statement in each successful output directory binds the deployed file, any rejected candidate, and the three inputs by SHA-256. The offline checker re-hashes the files and replays acceptance only after matching the code to a known fixture template. The local Statement is unsigned. Its stage history records the fixture's claims and carries no signer identity. [in-toto Statement specification](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)

The **Factory bootstrap** GitHub Actions workflow exercises both paths and checks the output again in a separate job. The **APMX package rehearsal** is manually dispatched from the default branch. It uses the upstream APMX workflow and a pinned upstream APM package to exercise contract execution with a fixture actor, an independent `apmx check` replay, and signed in-toto evidence. It uses no model credentials and proposes no Git changes. [APMX package fixture](https://github.com/danielmeppiel/apmx/tree/fae2067a0dc6ff07beda714015ff9e648f41ce63/tests/fixtures/run-workflow-package)

**Catalog reference rehearsal** calls the merged Forge Kit Skills workflow at the same immutable revision as the APM packages. Dispatch it from the default branch after configuring the repository's `COPILOT_GITHUB_TOKEN` secret. The catalog builds its reference candidate, signs the in-toto receipt in a separate checker job, and verifies it before local promotion. It rehearses rollback and one repair. Copilot summarizes the run with read-only access. [Catalog reference runbook](https://github.com/richgo/forge-kit-skills/blob/2ad068c4e1b2abe9b7dda65f5e8dab4835213558/docs/reference.md)

## Decision policy

The offline fixture supplies a deterministic recommendation. Setting `FORGE_JEV_TOKEN` explicitly opts into a live TypeSafe Jev choice call on an eligible build rejection. The request sends a fixed description of the fixture failure. The choice API can recommend retry or escalation. Local policy permits a retry only for an eligible rejection, a selected-label probability of at least 0.8, and an unused attempt. Low confidence, invalid responses and timeouts escalate. Deployment still requires a passing check. [TypeSafe decision API](https://github.com/TypeSafeAI/typesafe-router/blob/main/REFERENCE.md)

## Add capabilities

[`factory/packages.json`](factory/packages.json) records the immutable catalog reference for each capability. `node factory/cli.mjs assemble` lists the packages and the compiled workflow reference. `node factory/cli.mjs assemble --apm` renders the checked-in [`apm.yml`](apm.yml). Run `apm install --target copilot --frozen` with APM 0.33.0 to install from [`apm.lock.yaml`](apm.lock.yaml). The catalog's GitHub MCP configuration is a workflow import and stays in the external workflow package. [Forge Kit Skills catalog](https://github.com/richgo/forge-kit-skills/tree/2ad068c4e1b2abe9b7dda65f5e8dab4835213558)

1. Publish agent configuration, skills, contracts, checker logic, workflow primitives, and MCP configuration in external APM packages. Review package source, transitive pins, permissions, and installation effects before activation.
2. Add the package repository, optional package path, and full commit SHA to its role in the manifest. Keep the producer and checker in distinct execution environments with separate access.
3. Regenerate `apm.yml` and its lock after a package update. Update the caller's static `uses` reference when the orchestration package changes. CI checks the references and reproduces the install in a clean directory. Keep delivery behind verified evidence and GitHub's approval and branch rules. [Reusable GH-AW workflows](https://github.github.com/gh-aw/reference/faq/)
4. Connect APMX to the approved execution package and accept the independent checker's attestation only after validating its signer, definition digest, and delivered bytes. Keep live deployment and operational repair behind environment and policy gates. [APMX acceptance workflow](https://github.com/danielmeppiel/apmx/blob/fae2067a0dc6ff07beda714015ff9e648f41ce63/.github/workflows/run.yml)

The catalog workflow uses its own deterministic reference producer and a local deployment adapter. The pinned acceptance and repair packages provide native APMX contract entry points for separate execution. A combined live APMX-to-deployment path, durable signer identity, and a production environment adapter remain integration work.
