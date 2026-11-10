# ForgeKit: native APMX blueprint

This directory is the copyable, language-agnostic **consumer blueprint**. It is
not a second implementation of the APMX engine. The authoritative factory
contracts and independent checks are maintained in the pinned external APM
package at `richgo/forge-kit-skills/packages/software-factory`.

## Copy into a project

Copy `blueprint/.forge/verify-change` to `.forge/verify-change` in your
application repository, review it, and replace the explicitly failing example
commands with the project's real, pinned build, architecture, security and
acceptance checks. Copy `blueprint/request.md` as `request.md` and write an
approved change request. The application's language and build system remain
entirely project-owned.

Do not change the trust boundary: the independent checker must apply the
candidate patch to an isolated copy of the **reviewed base** without
credentials, then execute protected acceptance checks. Do not execute a
candidate-supplied checker or permit the candidate patch to change it.

The factory is invoked directly through APMX (the version and package SHA
must be pinned by the caller):

```sh
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --plan
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --on copilot
```

For GitHub Actions use the existing
`.github/workflows/apmx-factory.yml` reusable workflow pinned to a reviewed
ForgeKit commit. It delegates to the upstream APMX runner and independently
replays verification and attests the resulting delivery artifact.

## Interfaces

| Input/output | Owner | Meaning |
| --- | --- | --- |
| `request.md` | Reviewed project | Approved product/architecture change |
| `.forge/verify-change` | Reviewed project | Independent acceptance of an unapplied Git patch |
| `plan.md`, `specification.md` | APMX contracts | Derived agent handoffs |
| `changes.diff`, `implementation.md` | APMX build | Bounded source patch and report |
| `review.md` | APMX review | Advisory findings, not release authorization |
| `apm.yml`, `apm.lock.yaml` | Project | Pinned external skills and agent configuration |

## Boundaries

The APMX build output is a **checked patch**, not a deployed release. Protected
branch review, signed provenance, deployment, observation and recovery are
separate privileged stages and must not be bypassed by a successful APMX run.
The legacy `factory/*.mjs` reference implementation remains in the repository
until every security and production behavior has an independently qualified
CLI-native replacement. This migration intentionally does not claim it is
already removable.

The template fails closed until the consumer supplies real checks. A
language-agnostic blueprint must not silently substitute placeholder tests.

## Status and navigation

The reusable APMX blueprint is merged, but production parity is still being qualified. See [three consumer examples](../examples/consumers/README.md), [hosted APMX qualification](../factory/test/apmx-language-qualification.md), [migration gates](../docs/cli-native-migration.md) and [implementation status](../docs/implementation-status.md). The template checker must remain fail-closed until the consuming application provides independently reviewed checks.
