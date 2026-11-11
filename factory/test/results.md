# Qualification results

The release qualification recorded on 9 November 2026 tested ForgeKit at
`d8c1104f2bf963af553203cc883df8d3fa86b38e`, with catalog worker
`66a34368048c9105da54e888673de0c21e59d258`.

## Local and catalog checks

| Check | Outcome |
| --- | --- |
| Forge Kit Node suite | 50 passed, 0 failed, 0 skipped |
| External catalog with real Chromium | 40 passed, 0 failed, 0 skipped |
| Pinned catalog and requirements integration tests | 5 passed, 0 failed, 0 skipped |
| APM 0.33.0 | 9 packages installed, 10 audit checks passed. Missing lock and modified installed skill rejected. |
| Native CALM readiness checks | Direct and delegated models passed. The disconnected multi-node model was rejected. |
| Native APMX 0.8.0 replay | Replayed the captured hosted website receipt. 1 contract and 1 check passed. |
| Public Pages observation | The existing release manifest and all three published files matched the recorded release from `cf40f19`. Read-only probe. |

## Hosted runs

| Run | Outcome and boundary |
| --- | --- |
| [ForgeKit integration checks](https://github.com/richgo/forge-kit/actions/runs/42581806681) | Passed. Native CALM and LikeC4, independent Chromium checks, APM integrity, requirements evidence and APMX contract planning. |
| [Catalog integration checks](https://github.com/richgo/forge-kit-skills/actions/runs/42581696171) | Passed. Catalog tests with Chromium, compiled GH-AW export, signed local handoff and rollback, and native APMX package planning. |
| [Trail Desk worker qualification](https://github.com/richgo/forge-kit/actions/runs/42581801081) | Passed on the tested release revision. Restored the audited APM archive, ran Copilot and native APMX, independently verified AC-101 through AC-107 and site security, signed the exact archive, authenticated it, and rejected changed archive bytes and a wrong signer. Pages was skipped by request. |
| [Full agentic Trail Desk qualification](https://github.com/richgo/forge-kit/actions/runs/42581975630) | Passed on the tested release revision. GH-AW dispatched the worker, which restored APM, ran APMX and independent checks, and signed and authenticated the archive. Pages was skipped by request. |
| [Direct readiness](https://github.com/richgo/forge-kit/actions/runs/42532301262) and [delegated readiness with Jev](https://github.com/richgo/forge-kit/actions/runs/42531788391) | Both passed on their tested revisions. Each ran the pinned GH-AW/APMX path without publishing. |
| [Live Jev](https://github.com/richgo/forge-kit/actions/runs/42580682219) | Three HTTP 200 responses. Verified retry at 0.98, escalation at 0.87 and 0.90, and fail-closed checks for attempt, spend and time limits. |
| [Production rehearsal rejection](https://github.com/richgo/forge-kit/actions/runs/42580857009) | Expected failure. The explicit Pages drill request stopped at the isolated-repository guard. Pages was skipped. |

The CALM gate allows the unreferenced-node warning for the standalone
readiness probe. Hosted setup uses checksum-verified release artifacts.

## Consumer qualification

[Deterministic consumer acceptance](https://github.com/richgo/forge-kit/actions/runs/42897032550)
passed at ForgeKit revision `3d1a8f98e0b77a912d8c1bcc19194df39ead0f19`.
The suite exercised a valid source patch, protected-path rejection and
empty-patch rejection for Python, Go and TypeScript.

Record each agent run separately using the [hosted language checklist](apmx-language-qualification.md).
Live publication and restoration require their own deployment and observation
evidence. See the [implementation status](../../docs/implementation-status.md)
for the scope of each path.
