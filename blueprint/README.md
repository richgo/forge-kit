# ForgeKit consumer blueprint

The blueprint connects a project's approved change and independent acceptance
suite to the ForgeKit APMX contracts. Use the same factory package with any
application toolchain.

## Install in an application repository

Run this from the application Git repository root with Node.js 20 or later.
Replace `<reviewed-commit>` with the ForgeKit revision you want to install.

```sh
npx --yes --package="https://codeload.github.com/richgo/forge-kit/tar.gz/<reviewed-commit>" forgekit init --github-actions
```

This creates the three project inputs below and adds a manual GitHub Actions
workflow that calls ForgeKit at an immutable revision. For local execution,
omit `--github-actions`. Existing files with different content stop the install
before it writes any files. If ignore rules hide generated inputs, the command adds narrowly scoped .gitignore exceptions so Git and APMX can see them.

## Upgrade a project that uses the previous layout

Move the existing reviewed file to the new path and update references in
project docs, custom verifiers and SageKit input lists. Preserve its contents.

```sh
mkdir -p specs
git mv product-requirements.md specs/product-requirements.md
```

Update the pinned ForgeKit workflow or local software-factory package in the
same commit as the move. Reuse the reviewed request and verifier in the migrated project.

## Configure the project

1. Edit the installed [specs/product-requirements.md](specs/product-requirements.md). Describe the
   product outcomes, features, stories, architecture owners and observable
   acceptance criteria. Assign a stable check ID to each criterion.
2. Edit the installed [request.md](request.md). Select the approved story IDs, list the exact
   project-relative source paths permitted to change, and record any
   implementation constraints. Commit both reviewed files with the project.
3. Configure the installed [.forge/verify-change](.forge/verify-change) with executable,
   application-specific checks. The verifier receives an unapplied Git patch
   followed by the distinct check IDs from the selected stories.
4. Keep the check definitions and expected results in the approved base.
   Have the verifier validate patch scope and run the patch in a disposable,
   credential-free candidate tree. Run each requested check and the required
   build, regression, architecture and security checks. Return nonzero on
   failure or on an unknown check ID.

Use the [architecture checklist](architecture/README.md) and
[conformance checklist](tests/README.md) to review the checker.

For an OpenSpec-backed change, add the reviewed change artifacts and
`.forge/openspec.json`. The initializer creates the base project inputs.
Follow the [OpenSpec setup](../docs/reference-checkout.md#author-and-verify-an-openspec-change)
to install OpenSpec skills and validate the binding. Add a reviewed
`.forge/verify-baseline` when the change needs explicit test-first evidence.

## Run the contracts

Install APMX 0.8.0, Bash, Git, Node.js, the project toolchain and the Copilot CLI. APMX checks
for the selected harness when planning. From a clean copy of the approved project, inspect the contract plan and
then run the pinned package with Copilot.

```sh
apmx --from "richgo/forge-kit-skills/packages/software-factory#89eed7bdb145e8ec64ba08091968558cfee97daa" --plan
apmx --from "richgo/forge-kit-skills/packages/software-factory#89eed7bdb145e8ec64ba08091968558cfee97daa" --on copilot
```

The [APMX runbook](../docs/apmx-factory.md) covers workspace setup,
independent hosted replay and receipt attestation.

## Inputs and outputs

| File | Owner | Purpose |
| --- | --- | --- |
| `specs/product-requirements.md` | Project | Versioned requirements, ownership and acceptance criteria |
| `request.md` | Project | Approved story IDs and exact source scope |
| `.forge/verify-change` | Project | Protected verifier for the unapplied patch |
| `plan.md`, `specification.md` | APMX contracts | Reviewed inputs turned into scoped implementation guidance |
| `changes.diff`, `implementation.md` | APMX build | Candidate source patch and implementation report |
| `review.md` | APMX review | Advisory findings for the project reviewer |
| `apm.yml`, `apm.lock.yaml` | Project | Manifest and lock for capabilities installed through APM |

Compare the [Python, Go and TypeScript consumers](../examples/consumers/README.md)
to see how different toolchains implement the same verifier interface.
