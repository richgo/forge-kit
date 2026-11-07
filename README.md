# Forge Kit

Forge Kit is a reference software factory assembled from external APM packages. This increment contains a deterministic lifecycle fixture and an APMX package rehearsal. The fixture runs offline with Node.js 20 or later.

## Run the slice

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

The in-toto Statement in each successful output directory binds the deployed file and the three inputs by SHA-256. The offline checker re-hashes the files and applies the acceptance test without executing downloaded code. The local Statement is unsigned. Its stage history records the fixture's claims and carries no signer identity. [in-toto Statement specification](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)

The **Factory bootstrap** GitHub Actions workflow exercises both paths and checks the output again in a separate job. The **APMX package rehearsal** is manually dispatched from the default branch. It uses the upstream APMX workflow and a pinned upstream APM package to exercise contract execution with a fixture actor, an independent `apmx check` replay, and signed in-toto evidence. It uses no model credentials and proposes no Git changes. [APMX package fixture](https://github.com/danielmeppiel/apmx/tree/fae2067a0dc6ff07beda714015ff9e648f41ce63/tests/fixtures/run-workflow-package)

## Decision policy

The offline fixture supplies a deterministic recommendation. Setting `FORGE_JEV_TOKEN` explicitly opts into a live TypeSafe Jev choice call on an eligible build rejection. The request sends a fixed description of the fixture failure. The choice API can recommend retry or escalation. Local policy permits a retry only for an eligible rejection, a selected-label probability of at least 0.8, and an unused attempt. Low confidence, invalid responses and timeouts escalate. Deployment still requires a passing check. [TypeSafe decision API](https://github.com/TypeSafeAI/typesafe-router/blob/main/REFERENCE.md)

## Add capabilities

[`factory/packages.json`](factory/packages.json) records external APM sources. The rehearsal resolves a real package at a full commit SHA. Production roles are pending until the separate [forge-kit-skills repository](https://github.com/richgo/forge-kit-skills) or a reviewed upstream package publishes the corresponding exports. The assembly command resolves references for review and reports missing roles. It performs no installs.

1. Publish agent configuration, skills, contracts, checker logic, workflow primitives, and MCP configuration in external APM packages. Review package source, transitive pins, permissions, and installation effects before activation.
2. Add the package repository, optional package path, and full commit SHA to its role in the manifest. Keep the producer and checker in distinct execution environments with separate access.
3. Package the GitHub Agentic Workflows orchestration and its shared modules externally. Publish the compiled reusable workflow with a `workflow_call` entry point, and reference the export by the same immutable commit. Pass approved package refs into GH-AW's APM dependency mechanism and review the resolved lock. Keep delivery behind verified evidence and GitHub's approval and branch rules. [GH-AW APM dependencies](https://github.github.com/gh-aw/reference/dependencies/) · [Reusable GH-AW workflows](https://github.github.com/gh-aw/reference/faq/)
4. Connect APMX to the approved execution package and accept the independent checker's attestation only after validating its signer, definition digest, and delivered bytes. Keep live deployment and operational repair behind environment and policy gates. [APMX acceptance workflow](https://github.com/danielmeppiel/apmx/blob/fae2067a0dc6ff07beda714015ff9e648f41ce63/.github/workflows/run.yml)

The fixture's supported CALM and LikeC4 shape is one service. The architecture test compares its LikeC4 projection with the authoritative CALM data. The local deployment is an invoked artifact, and the observation is one readiness check. Live GH-AW orchestration, production APMX packages, durable execution state, deployment environments, telemetry and runtime repair remain subsequent increments. [FINOS CALM schema](https://github.com/finos/calm-schema) · [LikeC4 tooling](https://likec4.dev/tooling/cli/)
