# Run the APMX software factory

Forge Kit runs a pinned package of Markdown contracts against a reviewed
project. The project supplies the application language, architecture,
toolchain, and acceptance checks. Node.js and Python in older Forge Kit
examples are fixture choices.

```text
Approved request → Plan → Specification → Checked source patch → Advisory review
```

APMX resolves these handoffs from the contracts' declared inputs and outputs.
Its build contract uses the bounded patch exporter to deliver actual edits.
It runs the project's approved checks on the patch before admitting the build
output. The review report is advisory. A failed project check blocks delivery.
The build contract allows two attempts within a shared time budget.
[Factory package and contracts](https://github.com/richgo/forge-kit-skills/tree/0132bcc69ede85681462d7ffae8ae02cf909de42/packages/software-factory)

## Prepare a project

1. Review the base revision, including the source, architecture, build
   instructions, and existing acceptance tests. Use the project's own build
   tools and runtimes. The approved source must fit the selected APMX release's
   project capture and patch limits.
2. Add a reviewed Bash entry point at `.forge/verify-change` in the project
   root. The factory calls it with the path to the unapplied patch as its first
   argument. Have it enforce the project's allowed change scope, apply the
   patch in a disposable candidate tree, and run the required build, architecture,
   acceptance, and regression checks. A failure must exit nonzero.
3. Keep the independent tests and their expected outcomes under control of
   the approved base. Keep candidate execution in an isolated, credential-free
   environment. Use a pinned project toolchain or container as needed. Changes
   to the trusted checker or delivery policy go through their own review.

A project can check CALM and LikeC4, compile Go or Rust, run browser tests, or
use another toolchain through the same entry point. Bash and Git run the
factory's common verification step. The entry point chooses the tools for
the product.

## Preview locally

Install APMX 0.8.0 and a supported agent harness, then stage a copy of the
approved project in a clean directory outside the Git checkout. Put the
approved change in `request.md` at the project root. Run the plan to see
the contracts, artifacts, and checks without invoking the model.

```sh
apmx --from "richgo/forge-kit-skills/packages/software-factory#0132bcc69ede85681462d7ffae8ae02cf909de42" --plan
```

For an interactive run, use the same command without `--plan`. Native APMX
runs use host tools. Only run the approved factory and checker in an
appropriately isolated environment. [Upstream factory example](https://github.com/danielmeppiel/apmx/tree/fae2067a0dc6ff07beda714015ff9e648f41ce63/examples/contracts/software-factory)

## Run in GitHub Actions

Call [APMX software factory](../.github/workflows/apmx-factory.yml) as a
reusable workflow from your project's default branch, pinned to a reviewed
Forge Kit commit. Pass the reviewed request, the project directory relative to
the checkout, and your configured `COPILOT_GITHUB_TOKEN`. The calling job
needs contents read, attestation write, and OIDC write permissions.
For a project staged in this repository, you can also dispatch **APMX software
factory** on the default branch and select its directory.

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

The upstream workflow uses a separate job to replay the contract checks
against the approved base and exact outputs, then signs the checked receipt
and delivery files. Inspect `apmx-receipt` and `apmx-delivery` before using
the signed changes in a project review or protected release workflow.
Publication and runtime recovery remain responsibilities of the project's
approved delivery adapter. Forge Kit's Trail Desk Pages workflow illustrates
a separate product-specific deployment path. [Trail Desk hosted release](hosted-rehearsal.md)
