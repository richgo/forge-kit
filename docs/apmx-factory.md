# Run the APMX software factory

The [pinned factory package](https://github.com/richgo/forge-kit-skills/tree/0132bcc69ede85681462d7ffae8ae02cf909de42/packages/software-factory)
declares the file handoffs from `request.md` through `plan.md` and
`specification.md` to `changes.diff`, `implementation.md` and `review.md`.
The build contract exports an unapplied source patch, allows two attempts
within a shared 600-second budget and runs the project's verifier before accepting
the output. The review report supplies advisory findings.

## Prepare a project

1. Review the base source, architecture, build instructions and acceptance
   tests. Keep the project within the pinned APMX release's capture and patch
   limits and reserve the factory's output filenames at the workspace root.
2. Add the reviewed Bash entry point at `.forge/verify-change`. It receives
   the unapplied patch path as its first argument. Validate its scope, apply
   it in a disposable candidate tree and run the project's required checks.
3. Keep the checker and expected outcomes under control of the approved base.
   Use an isolated execution environment with the pinned project toolchain,
   no credentials and no untrusted network access. A disposable directory
   gives the checker a fresh tree. Use runner or container controls to
   enforce process, filesystem and network isolation.

See the [consumer blueprint](../blueprint/README.md) and
[example verifiers](../examples/consumers/README.md).

## Preview and run locally

Install [APMX 0.8.0](https://github.com/danielmeppiel/apmx/releases/tag/v0.8.0),
Bash, Git and the Copilot CLI. Put Copilot on the executable path for
planning and authenticate it for agent execution. Stage the approved project in a clean directory outside the Git
checkout, put the approved change in `request.md` and run from that directory.
The plan lists the contracts, handoffs and checks without invoking a model.

```sh
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --plan
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --on copilot
```

Inspect the patch and reports under `.apm/chains/<run-id>/artifacts/`. Use the approved project's
acceptance criteria and verify the patch identity when handing it off for
review.

## Run in GitHub Actions

Call the [APMX software factory workflow](../.github/workflows/apmx-factory.yml)
from the project's default branch. Pin it to a reviewed ForgeKit commit.
Supply the full approved request, the project directory relative to the
checkout and the Copilot token. The workflow writes the request input to
`request.md` in the staged workspace. The pinned runner uses Ubuntu 24.04.
Use tools available on that image or supply missing tools through a reviewed
checker or workflow adaptation.

```yaml
jobs:
  change:
    uses: richgo/forge-kit/.github/workflows/apmx-factory.yml@<reviewed-forge-kit-commit>
    permissions:
      contents: read
      attestations: write
      id-token: write
    with:
      workspace: "."
      request: "Describe the reviewed change and how to verify it."
    secrets:
      COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_GITHUB_TOKEN }}
```

For a project already staged in this repository, dispatch **APMX software
factory** on the default branch and supply the same workspace and request.

## Review the evidence

The independent job rebuilds the approved check environment and replays
the contract checks. Download `apmx-receipt` and `apmx-delivery`. The
attestations identify the delivered files by digest and bind them to the
checked receipt. Verify signer and source identity against the approved run.

Use `receipt.intoto.jsonl` to locate `changes.diff` and the check logs under
`evidence/sha256/` in `apmx-receipt`. The `apmx-delivery` artifact contains
the materialized files and records deletions in `.apmx-deleted` when applicable.
Use the [APMX audit guide](https://github.com/danielmeppiel/apmx/blob/fae2067a0dc6ff07beda714015ff9e648f41ce63/docs/audit.md)
to verify the signed delivery with a trusted signer policy.

The product's protected release workflow governs publication, observation
and recovery.

Use the [hosted language checklist](../factory/test/apmx-language-qualification.md)
to qualify an agent run on a consumer toolchain.
