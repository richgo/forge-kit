# Reference factory implementation status

This records the supported factory paths and their verification boundaries.
See the [target architecture](architecture.md) and the [component checks](../factory/test/components.md).

| Capability | Runnable path | Boundary |
| --- | --- | --- |
| Product intent | Tracked Epic → Feature → Story documents with stable acceptance IDs. The impact planner traces edits through story ownership and transitive consumers. | Readiness and Trail Desk have executable adapters. Other product documents can be planned with authored model pairs. |
| Architecture | FINOS CALM and LikeC4 native validation, exact flat projection comparison, generated Trail Desk models and authored direct/delegated readiness models. | The planner supports flat CALM 1.2 node-level connections. It rejects broader topology or view syntax. |
| Package assembly | APM 0.33.0 restores and audits the nine immutable catalog packages before the hosted build. Native APMX runs and independently replays the approved contract. | The reviewed repository lock is the package trust policy. The catalog admits new packages through review. |
| Planning and execution | GitHub Agentic Workflows calls one pinned worker. The worker prepares a scoped plan, builds from reviewed inputs, and uses Copilot through APMX. | The product adapters generate code deterministically. The hosted agent coordinates and produces contract output. |
| Decisions and repair | TypeSafe Jev advises an eligible readiness retry. Local policy enforces action, confidence, attempts, time, and work units. Independent replay checks the repair evidence. | The budget accounts for local work units. The readiness repair adapter has one retry. |
| Independent verification | A clean runner verifies the approved inputs, plan, architecture, behavior, security, package integrity and the contract. The website security checker comes from a pinned external APM package. | The acceptance and security rules are specific to the supported products. |
| Provenance and release | Separate GitHub jobs sign and authenticate the exact Pages archive, the APMX receipt and the independent evidence. The deployer needs the authenticated archive and the Pages environment. | The local unsigned receipt is for diagnostics. GitHub archive signatures apply to the hosted release path. |
| Observe and recover | The Pages adapter probes the public manifest and files. It authenticates and probes a selected prior release before publication and makes one restoration attempt after a deployment or probe failure. | Prior artifacts are kept for 90 days. Pages publication and rollback need the deployment environment. Continuous monitoring and broader remediation remain open. |

The [factory test records](../factory/test/README.md) distinguish local
checks, live provider calls, hosted qualification and production operations.
