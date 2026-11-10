# ForgeKit reference factory architecture

> **Implementation note (November 2026):** The recommended new-project path is the [CLI-native blueprint](../blueprint/README.md) using pinned APMX/APM capabilities. The `factory/*.mjs` commands described below document the **legacy reference implementation** and remain for regression/migration parity; they are not the portable blueprint. See [migration gates](../docs/cli-native-migration.md) and [current status](../docs/implementation-status.md). No live deployment or full multi-language agent qualification should be inferred from local reference tests.

> Target design, not a claim of full implementation. See [implementation status](implementation-status.md) and [factory testing](../factory/test/README.md).

## Purpose and invariants

ForgeKit is an open-source enterprise software factory for building robust, independently verified and eventually self-healing products. It transforms product intent into observed deployed outcomes through reproducible, evidence-backed stages. Agents propose changes; independent checkers and deterministic policies authorize them.

Build the factory **additively**: assemble, verify and activate one reusable capability at a time, retaining working slices. No unsafe promotion, unverifiable change or unbounded autonomous repair.

## End-to-end lifecycle

1. Capture **Epic → Feature → Story**, owners, outcomes and stable executable **Given/When/Then** acceptance IDs.
2. Model architecture in **FINOS CALM** as machine-readable input and **LikeC4** as a reviewable projection. Check drift and constraints before implementation.
3. Assemble pinned external capabilities using **APM** and run their contracts through **APMX**.
4. Orchestrate bounded planning, code, tests, security and build through **GitHub Actions / GitHub Agentic Workflows**.
5. Independently check acceptance, architecture, security, policy and package integrity. Producers must not alter their own acceptance oracle.
6. Produce **in-toto-compatible evidence** binding requirements, architecture, package lock, candidate digest, decisions, checker results and rejected attempts. Production promotion requires verified signatures and trusted identities.
7. Deploy only verified bytes behind explicit environment and approval gates; observe actual runtime health.
8. Diagnose failures, attempt **bounded repair**, independently reverify and repromote. Otherwise roll back and escalate.

```text
Intent → CALM / LikeC4 → plan → APM assembly → GH-AW execution
 → independent acceptance + APMX + security checks → provenance
 → approved deployment → runtime observation
                       ├─ healthy → retain evidence
                       └─ failed → bounded repair → reverify
                                      └─ rollback / escalate
```

## Decision-first design

Prefer typed decision APIs such as **TypeSafe Jev** over freeform inference for standards, policy classification and allowed actions. Separate: (1) advisory decisions, (2) deterministic enforcement and (3) independently observed verification facts. Validate schema, action allowlists, confidence, budgets and provenance. Missing, invalid or low-confidence decisions fail closed. No decision API may override failed tests or authorize its own deployment.

## Versioned external primitives

**Every skill, agent definition and configuration, prompt, workflow primitive, MCP configuration, policy, contract and checker must be a versioned external APM package.** Pin exact origins, immutable revisions and transitive dependencies in a lockfile. Review source, licences, install effects, trust level and permissions. When a high-quality upstream primitive is not packaged, copy or wrap it as a separately versioned external APM package with attribution and a documented update path; do not silently vendor unversioned primitives into the factory.

Candidate sources include **open-sdlc**, **Matt Pocock's skills**, **Anthropic**, **Hugging Face** and other high-calibre GitHub projects. Discovery does not imply approval: package provenance, security, fitness and test evidence determine admission.

## Security and evidence boundaries

- Independent acceptance, architecture, security, policy or provenance failure blocks promotion.
- Untrusted producers cannot rewrite checkers, approved requirements, signing identities or deployment policy during their own evaluation.
- Separate permissions for producer, verifier, attestor and deployer; apply least privilege and environment approvals.
- Retain accepted and rejected candidates, digests, decisions, repair attempts, rollbacks and escalations.
- Runtime health must be observed; an agent assertion or green CI badge is insufficient.
- Repair loops have bounded attempts, time and spend, and explicit human escalation.

## Reference versus target

The current checked-in Node reference demonstrates a deterministic vertical slice, bounded fault/repair, local verification and rehearsal workflows. It is **not** a complete general-purpose enterprise factory or production self-healing system. See [implementation status](implementation-status.md) for gaps and [factory tests](../factory/test/README.md) for the evidence required to close them.
