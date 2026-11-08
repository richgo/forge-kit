# Factory testing and end-to-end assurance

**This directory is the canonical home for factory test plans, scenarios, rehearsal instructions, expected evidence and results.** Executable code may remain under `test/`, `evals/` and `.github/workflows/`; link to it from here. Keep architecture and product design in `docs/`, not test runbooks.

## Test levels

| Level | Goal | Current entry points |
| --- | --- | --- |
| Unit / contract | Validate individual requirements, architecture, packages, decisions and validators | `test/*.test.mjs` |
| Integration | Validate APM/APMX, Jev, architecture and evidence boundaries | `evals/*.mjs`, `factory/*.mjs` |
| Reference E2E | Verify intent → faulty build → independent check → bounded repair → observation | `test/end-to-end.test.mjs` |
| Hosted rehearsal | Exercise deploy/observe/recover path under GitHub Actions | `.github/workflows/*.yml`, `docs/hosted-rehearsal.md` |
| Adversarial | Demonstrate rejection, isolation and safe rollback | Scenario tests and fault injection; expand coverage |
| Production qualification | Verify signed provenance, environment controls and real runtime health | **Not yet demonstrated by the fixture** |

## Required E2E scenario catalogue

Each scenario must identify preconditions, pinned package set, story acceptance IDs, injected fault, expected action, independent evidence, promotion decision and cleanup.

| ID | Scenario | Expected invariant |
| --- | --- | --- |
| F-E2E-01 | Valid story to deployed observed outcome | Same verified artifact digest throughout |
| F-E2E-02 | Failing acceptance criterion | Promotion blocked |
| F-E2E-03 | Deliberately faulty generated code | Independent checker rejects it |
| F-E2E-04 | Bounded repair succeeds | Recheck all acceptance criteria before promotion |
| F-E2E-05 | Repair budget exhausted | Escalation; no unsafe promotion |
| F-E2E-06 | Missing/changed APM package lock | Assembly or promotion blocked |
| F-E2E-07 | Malicious/untrusted package or workflow | Trust and permissions boundary enforced |
| F-E2E-08 | CALM/LikeC4 drift or forbidden dependency | Architecture gate fails |
| F-E2E-09 | Invalid/low-confidence Jev response | Fail closed; deterministic policy retained |
| F-E2E-10 | Missing/invalid in-toto signature or digest | Trusted promotion denied |
| F-E2E-11 | Deployment succeeds but health probe fails | Rollback or escalation, with evidence |
| F-E2E-12 | Agent attempts to alter checker/acceptance oracle | Tampering detected; candidate rejected |

## Evidence contract

Record run ID, UTC timestamp, workflow and runner identity, story/acceptance IDs, CALM/LikeC4 revisions, APM package lock and immutable source SHAs, candidate/artifact digests, typed decisions, policy versions, independent checker results, rejected attempts, signer identities, attestation verification, deployment environment, runtime observations, repair/rollback actions and final outcome.

A local unsigned receipt is suitable for development diagnostics but **must not** be labelled production-grade attestation. Never mark a scenario passed without its expected observable evidence.

## Running existing checks

From the repository root:

```bash
npm test
```

Inspect `package.json` for additional supported scripts before invoking them. For GitHub-hosted tests, use the workflows in `.github/workflows/` and follow `docs/hosted-rehearsal.md`. Credentialed live evaluations are separate from deterministic offline tests; do not silently substitute one for the other.

## Release gates and reporting

- Maintain a test record for each scenario: **implemented / automated / passing / evidence verified** as distinct states.
- Report blocked or unimplemented scenarios explicitly rather than treating them as passed.
- Require independent verification and trusted signed provenance before any real promotion.
- On every change to a package, policy, checker, architecture or workflow, rerun affected contracts plus reference E2E.
- Preserve the complete failure and repair history for review.
