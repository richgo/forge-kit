# Phase 4 qualification and operating measurements

## Component-to-test traceability

| Component | Coverage and entry point | Evidence and boundary |
| --- | --- | --- |
| Requirements and story acceptance | `test/end-to-end.test.mjs`, `evals/requirements-scenarios.mjs`, both products' `acceptance.json` | Independent acceptance rejects fabricated output and reruns 5 initial and 8 evolved cases per product. |
| CALM, LikeC4 and migration impact | `test/architecture-plan.test.mjs`, `test/impact.test.mjs`, native validators in the hosted verifier | Covers model and view drift, dependency impact, incompatible interfaces and reviewed migrations. |
| Frozen APM and capability trust | `test/capability-governance.test.mjs`, `factory/test/apm-integrity.sh`, bootstrap clean restore | Covers changed package bytes, unknown APIs, revoked pins, repository casing and lock tampering. |
| Agent and repair boundaries | `test/agent-production.test.mjs`, `test/phase-four-adversarial.test.mjs`, `test/jev.test.mjs` | A synthetic injected tool request stops the handoff. Forged acceptance output fails. Audit binding and bounded repair are exercised offline. |
| Candidate isolation and resource limits | `test/agent-verifier.test.mjs` and `test/phase-four-adversarial.test.mjs` with `FORGE_TEST_CONTAINER=1` | Bootstrap uses the pinned Docker image to check host environment and network isolation, read-only source, output flood rejection and subsequent recovery of the runner. |
| Browser and website security | `test/website.test.mjs`, native Chromium preview in bootstrap, pinned Skills catalog CI | Browser regression and injection rejection for Trail Desk Pages. Stock Ledger uses the CLI contract. |
| Interruption and retry | `test/delivery-checkpoint.test.mjs`, owner-dispatched resume drill | Validates checkpoint binding, one-time interruption, reuse of initial artifacts and rejection of cross-run or changed state. |
| Supply-chain gates | `test/supply-chain.test.mjs`, hosted Trivy, signer and release jobs | Verifies secret scanning, SBOM and lock binding, vulnerability policy, signed promotion and SLSA provenance. Hosted release rejects tampered and missing evidence. |
| Release and incident recovery | `test/runtime-recovery.test.mjs`, `test/runtime-incident.test.mjs`, `test/pages-deployment-guard.test.mjs`, hosted two-product drill | Covers unhealthy content, stale or unknown releases, idempotency, independently verified restoration, and fail-closed paths. Hosted fault injection uses an isolated release pointer. |
| Performance, economics and alerts | `test/qualification-runtime.test.mjs`, `test/qualification-metrics.test.mjs`, hosted qualification summary | Checks timing arithmetic, missing measurements and threshold breaches. Reports stage durations, archived agent sessions, repair attempts and recovery measurements. |

Bootstrap runs the regression suite and real container checks on pull requests
and changes to main. A capability change also needs the Skills catalog checks
and a consumer PR that pins the proposed revision. Dispatch the signed
two-product qualification from a reviewed ref for changes to release, recovery,
or the capability lock. This requires the existing trusted dispatch policy.

## Hosted rehearsal

Dispatch **Factory bootstrap** with `agent_products=true`,
`agent_resume_drill=true`, `agent_replay_drill=true` and `pages_drill=false`.
Attempt 1 persists initial artifacts and then deliberately stops. Rerun failed
jobs. The original signed Phase 2 source is authenticated again and retained
as the origin in the new signed bundle. Both products then pass clean restore,
independent verification, source and runtime scanning, signed evidence
verification, reproduction and isolated recovery.

The final job publishes `qualification.json` and `qualification.md` as
`qualification-attempt-N`. Its product totals come from Actions job timestamps
and retained artifacts. GitHub rerun count records observed actions. Distinct
operators and provider billing are unknown. Agent session and repair counts in
replay describe the original run. Production change failure rate, mean time to
restore, and operator intervention rates require a production observation
window.

## Measurements and alert routing

| Signal | Rehearsal threshold | Interpretation |
| --- | --- | --- |
| Healthy probe p95 | At most 2,500 ms per product | Nearest-rank p95 of real one-request probes across healthy stages, including container startup and cleanup. |
| Failure-to-healthy interval | At most 30,000 ms per product | From the end of the final injected failure probe to the end of the final healthy restoration probe. |
| Evidence and acceptance | All required evidence validates and all accepted cases pass | Missing, changed or mismatched artifacts fail qualification. |

A rehearsal threshold breach fails the qualification job and appears in the job
summary and retained report. Use the failed workflow and linked artifact to
separate a performance breach, provider failure, security rejection or runtime
fault. The Pages workflow uses a separate issue-based incident path.

Candidate production targets for review are an authenticated observation at least
every six hours and 99% healthy scheduled observations over a rolling 30-day
window. A deployment or availability target requires signed baselines,
authorized recovery, a defined alert owner and retained observation data.
Qualification of these targets, live alert delivery and a production fault
drill remain open.

## Production boundary

A read-only check on 10 November 2026 matched the public Pages manifest,
HTML, CALM and LikeC4 digests to
[production run 42522158400](https://github.com/richgo/forge-kit/actions/runs/42522158400).
The observed release still lacks a signed Pages rollback bundle. The
`github-pages` environment reported a branch policy only. Production requires
a signed baseline migration, confirmed reviewer and alert policies, and
authorization for any live fault exercise. The hosted Phase 4 drill qualifies
the isolated path for Trail Desk and Stock Ledger. It uses archived agent
source and measures the current pipeline from verified source through recovery.


## Qualification record

The [10 November hosted run](https://github.com/richgo/forge-kit/actions/runs/42774444176)
passed on attempt 2 at `0fcaeab05ef4f4efdf8b5c6c2352f5ddeaf6a1b9`.
The first attempt stopped at the two deliberate interruption steps. The second
reused both original checkpoints, verified 26 independent acceptance checks
across four revisions, and authenticated both signed promotion records and
SLSA provenance. Missing SBOM and tampered promotion cases failed closed.
Both signed bundles reproduced byte-for-byte and both injected application
faults ended with the last healthy release independently re-observed.

| Product | Acceptance checks | End-to-end lead (s) | Product runner time (s) | Probe p95 (ms) | Failure-to-healthy (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| Trail Desk | 13 | 283 | 226 | 214 | 1,640 |
| Stock Ledger | 13 | 282 | 215 | 262 | 2,038 |

Each product had 42 runtime probes, including 8 probes against its deliberate
fault. Both passed the rehearsal thresholds. The lead times include one
workflow rerun and elapsed queue time. The archived source audit records
eight agent sessions per product and zero repair calls.
The run's `qualification-attempt-2` artifact contains the report and measured
stages. The [ForgeKit PR check](https://github.com/richgo/forge-kit/actions/runs/42774492638)
passed the frozen install, tests, native validators and real container probes.
All 117 local tests passed using the exact pinned capability files.

This record qualifies the isolated two-product pipeline. Live publication,
production recovery and alert delivery, fresh authoring in this rehearsal,
and billing and production SLO measurements remain outside this evidence.
