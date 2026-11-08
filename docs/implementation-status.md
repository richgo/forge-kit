# Reference factory implementation status

This document distinguishes **demonstrated reference behavior** from the **target design** in [architecture](architecture.md). Do not interpret a passing local fixture as proof of enterprise readiness.

| Capability | Current reference | Required next step |
| --- | --- | --- |
| Product intent | Product requirements and scenario fixtures | Generic epic/feature/story intake, immutable acceptance IDs and change control |
| Architecture | CALM/LikeC4-inspired reference inputs and checks | Full CALM validation, LikeC4 projection and architecture drift gates |
| Capability assembly | APM manifest/lock and APMX rehearsals | Enforce external versioned APM packaging for every primitive; trust, licence and transitive lock checks |
| Orchestration | GitHub Actions and local Node flow | Reusable GitHub Agentic Workflows with isolated producer/checker identities and budgets |
| Decisions | Jev integration and evaluation fixtures | Typed decision API contracts with deterministic policy enforcement and failure handling |
| Verification | Offline tests, scenario evaluations and rehearsal workflows | Independent acceptance oracle, policy/security suites and signed test evidence |
| Provenance | Local evidence and catalog rehearsal | Complete signed in-toto supply-chain attestations verified at promotion |
| Deployment | Local/optional hosted rehearsal | Gated adapters, artifact identity checks and rollback controls |
| Observation | Reference fixture and hosted probes | Durable runtime telemetry, SLOs and incident correlation |
| Self-healing | Bounded reference repair | Policy-bounded production remediation, independent revalidation, rollback and escalation |
| End-to-end | Node tests and opt-in hosted drills | Repeatable full-path factory E2E with fault injection and verified evidence |

## Progression criteria

1. Each new primitive is versioned, pinned and independently testable.
2. Each vertical slice maps a story acceptance ID to source, architecture, check results, artifact digest and observation.
3. Failed acceptance or missing provenance demonstrably blocks promotion.
4. Repair preserves a full attempt history and never bypasses gates.
5. Factory tests document success and adversarial paths before capability activation.

See [factory/test](../factory/test/README.md) for test levels and E2E scenarios.
