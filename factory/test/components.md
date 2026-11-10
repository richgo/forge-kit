# Factory component checks

Restore the lock with APM 0.33.0, then run `node --test` for the repository suite. The native architecture and
package checks below use real upstream binaries. The GitHub dispatches
use repository credentials and record separate artifacts.

| Component | Entry point and success evidence | Rejection and recovery coverage |
| --- | --- | --- |
| Product requirements and planning | `node --test test/impact.test.mjs test/website.test.mjs`. The planner emits changed CALM and requirement IDs, affected consumers and the acceptance criteria in scope. PR preview uploads the Trail Desk and readiness plans. | Duplicate IDs, a changed acceptance owner, unsupported criteria, missing CALM owners, removed dependencies and view drift. |
| CALM and LikeC4 | `bash factory/test/native-architecture.sh` runs the pinned FINOS validator on direct and delegated fixtures. GitHub preview and the worker run native LikeC4 validation. [Architecture impact](architecture-impact.md) | Unexpected CALM warnings and schema errors block the gate. The sole warning allowed for a standalone service is CALM's unreferenced-node warning. The factory separately verifies the projection and owner. |
| APM catalog and package lock | Run `node factory/cli.mjs assemble` to inspect every role, then run `apm install --target copilot --frozen` and `apm audit --ci` with APM 0.33.0, or run `bash factory/test/apm-integrity.sh /path/to/apm` to exercise the positive and adversarial cases in a scratch directory. The hosted assembly job checks the generated manifest and unchanged lock. | Tests reject mutable references. Frozen install rejects a missing lock and audit checks file integrity and replay drift. The reviewed manifest is the catalog trust policy for this repository. |
| APMX and GitHub Agentic Workflows | **APMX package rehearsal** exercises the pinned contract. **Forge Factory E2E** invokes the compiled GH-AW worker, executes the native contract with Copilot, and replays it in a fresh job. [Hosted release](hosted-release.md) | A missing worker call, failed contract, different output or missing evidence fails the run. Producer credentials never reach the independent verifier. |
| Typed Jev and local repair | `node --test test/jev.test.mjs test/factory.test.mjs`. Dispatch **Factory bootstrap** with `jev_probe=true` for three live cases. [Jev](jev.md) | Invalid or ambiguous responses, wrong advisor, altered evidence, timeouts, exhausted work units, exhausted attempts and persistent candidate failure. |
| Independent product acceptance and security | `node --test test/end-to-end.test.mjs test/website.test.mjs`. The hosted worker replays the trusted story in a separate job. Trail Desk also runs native Chromium and the catalog security checker. [Website security](website-security.md) | Tampered HTML and architecture, incorrect readiness behavior, rejected code, injected scripts, CSP and outbound-resource violations. |
| in-toto and promotion | **Forge Factory E2E** with `publish_pages=false`. Inspect the authenticating job, `factory-verified` and `factory-release-proof`. [Hosted release](hosted-release.md) | The hosted check verifies the valid archive and then rejects altered bytes and the wrong signer revision with the same signature. Local receipt tests reject tampered artifacts, check reports and repair decisions. |
| Delivery, observation and rollback | The signed catalog lifecycle in `evals/catalog-scenarios.mjs` runs a loopback HTTP deployment with deliberate post-promotion corruption. The hosted Pages worker authenticates a prior archive, checks the currently served bytes, and can restore and re-probe the archive. [Hosted release](hosted-release.md) | Unhealthy candidate, changed deployment bytes, failure to authenticate or observe the prior release, and failed restoration. The local rollback test and the production Pages recovery path have separate evidence. |

For the catalog and requirements suites, use the pins in `factory/packages.json`.
Run the following with the two environment variables set to those checkouts.

```sh
node --test evals/catalog-scenarios.mjs evals/requirements-scenarios.mjs
```

`FORGE_CATALOG_DIR` points to the catalog checkout at the `delivery` pin.
`FORGE_REQUIREMENTS_PACKAGE` points to `packages/requirements` in the
catalog checkout at the `skills` pin. Both suites fail if their package
input is missing. Run the browser security tests in the pinned catalog
checkout using the Chromium instructions in the security runbook.

> **CLI-native migration:** The [copyable blueprint](../../blueprint/README.md) is the recommended new-project entrypoint. Legacy JavaScript runtime examples are retained for regression parity; see [implementation status](../../docs/implementation-status.md).
