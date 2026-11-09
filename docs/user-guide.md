# Forge Kit user guide

Use Forge Kit to take an approved product or architecture change from a pull request to an independently checked release. Start with the role that owns your next decision. This guide assumes the **target workflow** is in place. The final section points to the parts you can try in the reference implementation today.

A small team can share these responsibilities. The factory keeps the build, independent check, signing, and deployment in separate jobs with different permissions. [Factory architecture](architecture.md)

| Role | Where you work | What you decide |
| --- | --- | --- |
| [Product owner](#product-owner) | Product requirements and pull request | Does the change deliver the agreed outcome? |
| [Architect](#architect) | CALM model, LikeC4 view, and impact plan | Does the design respect the system's constraints? |
| [Engineer](#engineer) | Change branch and factory build | Does the candidate implement the approved plan? |
| [Platform maintainer](#platform-maintainer) | Capability catalog, lockfile, and workflow configuration | Can the factory use this capability with the right permissions and checks? |
| [Independent verifier or reviewer](#independent-verifier-or-reviewer) | Independent check job and verification evidence | Did this exact candidate pass against the approved inputs? |
| [Release operator](#release-operator) | Protected release environment and runtime observations | Is the release eligible to go live, and is it healthy once deployed? |

## Product owner

1. **Describe the outcome.** Open a pull request against the product requirements. Use an epic for the outcome, a feature for the capability, and a story for the person who needs it and why. Agree on the owning system component with the architect.
2. **Define success.** Give each Given/When/Then criterion a stable ID. For Trail Desk distance sorting, state the expected order, how users return to the original order, and how sorting interacts with the step-free filter. Include existing behavior that must keep working.
3. **Review the impact and preview.** Check that the factory plan includes the intended stories and affected consumers. Review the proposed behavior against the criteria. Ask for a revised proposal if it changes something you did not intend.

**Handoff.** Approve the requirements revision, story IDs, and acceptance criteria for engineering and independent verification. [Requirements authoring guide](product-requirements.md) · [Trail Desk example](../examples/trail-desk/current/product-requirements.json)

## Architect

1. **Propose the model change.** Edit the authoritative CALM model and update its LikeC4 view, or review both generated models when a product change drives the design. Record any new dependency, operational constraint, or migration step in the pull request.
2. **Review the impact plan.** Check the changed components, downstream consumers, story owners, and acceptance checks to rerun. Resolve mismatched views, invalid relationships, and missing owners before the build starts.
3. **Specify how to prove the design works.** If a readiness probe moves to a separate worker, require the verifier to observe the worker running while the probe still returns its agreed response.

**Handoff.** Approve the model and its view, the affected stories and checks, and any deployment or recovery constraints. [Architecture impact examples](../factory/test/architecture-impact.md)

## Engineer

1. **Start from the approved change.** Review the story, architecture, impact plan, and selected package revisions. Flag missing capabilities or tests before proceeding. Route changes to approved requirements, architecture, or check definitions through their owners for review.
2. **Build a candidate.** Use the reviewed workflow. APM installs the locked capabilities, and the GitHub workflow coordinates the build and any APMX contracts. Inspect the candidate and its build results against the impact plan.
3. **Respond to rejection.** Use the independent check findings to propose a fix. Submit a new candidate for replay. If the factory attempts an automated repair, inspect its decision, results, and remaining budget before handing the new candidate back.

**Handoff.** Share the candidate reference, source revision, acceptance IDs, and build and repair history with the verifier. [Verification and evals](testing.md)

## Platform maintainer

1. **Review capabilities before adding them.** Inspect the package source, permissions, transitive dependencies, and installation effects. Pin the reviewed revision in the capability manifest, refresh the APM manifest and lock, and update the pinned workflow reference when the orchestrator changes.
2. **Qualify both setup and execution.** Reproduce the frozen APM install, run the APMX contract, and have a separate verifier replay its checks. Exercise failures that should block promotion, such as a changed archive, a wrong signer, or a missing check. Qualify without publication first.
3. **Configure the release and recovery rules.** Scope credentials to the jobs that use them. Set trusted signer identities, protected environments, required approval, and recovery limits. Treat Jev's recommendation as an input to policy. Policy checks the proposed action, confidence, and remaining budget before authorizing it.

**Handoff.** Publish the approved package and workflow pins, qualification evidence, and policy changes for the verifier and release operator. [Capability manifest](../factory/packages.json) · [Hosted qualification](../factory/test/hosted-release.md)

## Independent verifier or reviewer

1. **Establish what was approved.** Load the requirements, architecture, lockfile, and check definitions from trusted revisions. Match the candidate and its digest to the selected change. Treat the candidate as input to the checks and keep the check definitions under separate control.
2. **Replay the checks.** Verify product behavior, architecture compliance, security and policy, and package integrity. Replay the contract checks with APMX where applicable. Record which acceptance IDs passed and which findings block release.
3. **Hand passing results to signing.** Bind the independently checked artifact and its evidence together so the signing job can attest to the exact candidate. If any required evidence is missing or a check fails, hold the release and return the finding to the appropriate owner.

**Handoff.** Give the operator the checked artifact identity and signed evidence, or give the owner the failed check and the expected result. [Factory evidence contract](../factory/test/README.md)

## Release operator

1. **Review the release and fallback.** Confirm the approved source revision, independent results, and signed artifact identity. Confirm the approved environment and that a verified last known-good release is available under the release policy.
2. **Approve publication and check it live.** The delivery job verifies the signer and artifact before deploying the exact bytes that passed. Review the live observation for the expected release identity and behavior. Retain the release and observation records together.
3. **Handle a failed release or later incident.** Hold further promotion. If policy authorizes restoration, restore the verified predecessor and probe it again. If restoration cannot be authorized or confirmed, investigate the incident with the recorded observations. Send any proposed code repair through independent checks, signing, and release approval as a new candidate.

**Handoff.** Record the active release, fallback, live check result, and any restoration attempt or escalation. [Hosted release gate](../factory/test/hosted-release.md) · [Runtime recovery example](../factory/test/phase-one-runtime.md)

## Try the reference implementation

- **Product and architecture review.** Inspect the `trail-desk-pr-preview` artifact in the **Factory bootstrap** pull request run. Compare the before and after site, the CALM and LikeC4 diffs, the impact reports, and browser evidence. [Hosted rehearsal](hosted-rehearsal.md)
- **Local build and replay.** From the repository root with Node.js 20 or later, run the commands below with a fresh output path. The readiness fixture creates an unsigned receipt and verifies it locally. [Factory testing](../factory/test/README.md)
- **Hosted verification and operations.** Use **Forge Factory E2E** with `website_release=current` and `publish_pages=false` for a configured Trail Desk qualification run. Use the release and runtime runbooks for publication, signed fallback selection, and recovery prerequisites. [Hosted release runbook](../factory/test/hosted-release.md) · [Runtime recovery runbook](../factory/test/phase-one-runtime.md)

```sh
node factory/cli.mjs run out/guide-readiness
node factory/cli.mjs verify out/guide-readiness
```

The reference adapters cover the readiness fixture and the Trail Desk static site. Other products need their own executable build, acceptance, and delivery capabilities. [Implementation status](implementation-status.md)
