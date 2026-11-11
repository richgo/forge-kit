# ForgeKit user guide

Start with an approved outcome and decide how the project will prove it.
The same workflow applies to a product feature, an interface change or an
architecture constraint.

## Product owner

Write the desired outcome and the behavior that must stay intact. Give each
acceptance criterion a stable ID and describe an observable result. In the
quote example, specify the discounted total, the zero floor and the expected
invalid-input behavior. Approve the request and its criteria before running the
factory. [Requirements guide](product-requirements.md)

## Architect

Review the affected components, interfaces and downstream consumers.
Update the architecture inputs and their reviewable view when the change
alters the design. Identify the checks that will prove both the structure
and the externally visible behavior. [Architecture guidance](../blueprint/architecture/README.md)

## Engineer

Stage the approved project with `request.md` and `.forge/verify-change`.
Inspect the pinned APMX plan, run the approved agent harness and read the
resulting `changes.diff` and implementation report. When a check rejects
the patch, use its findings to produce another candidate against the same
approved base. Route changes to requirements, trusted checks or package
pins through their owners. [APMX runbook](apmx-factory.md)

## Platform maintainer

Review and pin the external capabilities, toolchains and workflows. Keep
the agent, independent verifier, attestor and deployer in separate trust
contexts. Qualify the verifier with both valid and rejected patches before
authorizing a hosted run. [Factory components](components.md)

## Independent reviewer

Match the patch to the approved request and base. Confirm that the trusted
checks ran against the exact candidate and that the patch left protected
inputs intact. For a hosted run, authenticate the signed receipt and check
that its recorded output identities match the delivery files. Review
`review.md` alongside the patch and the independent results. [Verification guide](testing.md)

## Release operator

Apply the product's protected release policy to the approved artifact.
Confirm its signed identity, target environment and authenticated fallback
before publication. Observe the deployed behavior and record the active
release. If it fails, follow the product's recovery policy and probe any
restored release. [Trail Desk release example](hosted-rehearsal.md)
