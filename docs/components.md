# Factory components

| Component | Responsibility | Interface or entry point |
| --- | --- | --- |
| Approved project | Own the requested behavior, reviewed source, architecture and test expectations. | [Requirements template](../blueprint/product-requirements.md) and [request template](../blueprint/request.md) |
| APM and capability catalog | Resolve reviewed skills, agent configuration, contracts and supporting tools at immutable revisions. Use a frozen lock for reproducible installations. | [APM manifest](../apm.yml), [lock](../apm.lock.yaml) and [catalog roles](../factory/packages.json) |
| APMX | Resolve the contract graph, produce artifacts, bound agent execution and replay declared checks. | [Factory workflow and CLI runbook](apmx-factory.md) |
| Project verifier | Check the candidate's scope, apply the unapplied patch in an isolated copy of the approved base and run trusted acceptance. Return a nonzero exit status on failure. | [Blueprint checker](../blueprint/.forge/verify-change) and [consumer examples](../examples/consumers/README.md) |
| Architecture tools | Validate CALM and LikeC4 and enforce the project's topology, interfaces and dependency constraints. | [Architecture inputs](../blueprint/architecture/README.md) and [architecture impact fixture](../factory/test/architecture-impact.md) |
| Independent runner and attestor | Replay the checks on the approved base and bind the checked outputs to a trusted build identity. | [Hosted APMX workflow](../.github/workflows/apmx-factory.yml) |
| Release and observation adapters | Authenticate exact release bytes, enforce environment approval and record live health. | [Trail Desk Pages runbook](hosted-rehearsal.md) |
| Decision advisor and recovery policy | Request typed recommendations through a provider adapter. Apply action allowlists, budgets and authenticated fallback checks locally. | [Decision providers](decision-providers.md) and [recovery policy](../factory/test/recovery-policy.md) |

## Package trust

Review each capability's origin, revision, licence, transitive dependencies, permissions and install effects before adopting it. Pin reusable agent primitives as external APM packages. When a primitive needs a wrapper, package and version the wrapper with its upstream attribution. The project owns the package pins and the acceptance policy.

The `--from` reference pins the APMX contract package. Projects that install a capability set with APM commit the reviewed manifest and lockfile and reproduce the install with `apm install --target copilot --frozen`. See the [package integrity checks](../factory/test/components.md).

## Permission boundaries

Give the producer access to the approved inputs and a way to return candidate output. Run project checks with a separate trust context. Give signing credentials only to the attestation job and deployment permissions only to the protected release job. Verify the artifact digest and trusted identity at every privileged handoff.

See [implementation status](implementation-status.md) for qualification evidence.
