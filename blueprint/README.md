# ForgeKit consumer blueprint

The blueprint connects a project's approved change and independent acceptance
suite to the ForgeKit APMX contracts. Copy the request and verifier templates
into the project root. Use the same factory package with any application
toolchain.

## Configure the project

1. Copy [request.md](request.md) and describe the reviewed outcome, allowed
   source paths, protected interfaces and observable acceptance criteria.
2. Copy [.forge/verify-change](.forge/verify-change) to the same relative
   path in the project. Replace the fail-closed template with executable,
   application-specific checks. The verifier receives an unapplied Git patch
   as its first argument.
3. Keep the check definitions and expected results in the approved base.
   Have the verifier validate patch scope and run the patch in a disposable,
   credential-free candidate tree. Run the required build, acceptance,
   regression, architecture and security checks. Return nonzero on failure.

Use the [architecture checklist](architecture/README.md) and
[conformance checklist](tests/README.md) to review the checker.

## Run the contracts

Install APMX 0.8.0, the project toolchain and the Copilot CLI. APMX checks
for the selected harness when planning. From a clean copy of the approved project, inspect the contract plan and
then run the pinned package with Copilot.

```sh
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --plan
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --on copilot
```

The [APMX runbook](../docs/apmx-factory.md) covers workspace setup,
independent hosted replay and receipt attestation.

## Inputs and outputs

| File | Owner | Purpose |
| --- | --- | --- |
| `request.md` | Project | Approved change and acceptance criteria |
| `.forge/verify-change` | Project | Protected verifier for the unapplied patch |
| `plan.md`, `specification.md` | APMX contracts | Reviewed inputs turned into scoped implementation guidance |
| `changes.diff`, `implementation.md` | APMX build | Candidate source patch and implementation report |
| `review.md` | APMX review | Advisory findings for the project reviewer |
| `apm.yml`, `apm.lock.yaml` | Project | Manifest and lock for capabilities installed through APM |

Compare the [Python, Go and TypeScript consumers](../examples/consumers/README.md)
to see how different toolchains implement the same verifier interface.
