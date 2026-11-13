# ForgeKit

ForgeKit is a CLI-native, language-agnostic software factory. It turns an approved product or architecture request into a source patch that a project's independent checks can accept for review. APM installs versioned capabilities, and APMX runs the contracts that turn the request into a plan, specification, implementation and review.

The project owns its language, toolchain, architecture, acceptance criteria and release policy. ForgeKit defines the handoffs between the agent that proposes a change, the verifier that checks it and the operator who can authorize publication.

## From change request to release

The target workflow runs each stage in isolation. Request admission anchors
the chain to the approved project revision. Every later stage verifies its
incoming attestation and artifact digest. An independent check gates each
new signed in-toto handoff.

```mermaid
flowchart LR
    P["Product change<br/>Requirements and acceptance criteria"] --> A
    T["Architecture change<br/>Models, interfaces and constraints"] --> A
    A["1. Admit request<br/>Check approved base, scope and inputs<br/>Sign in-toto"] --> B
    B["2. Plan<br/>Check impact and affected tests<br/>Sign in-toto"] --> C
    C["3. Specify<br/>Check traceability and interface contracts<br/>Sign in-toto"] --> D
    D["4. Build<br/>Check exact patch, build and acceptance<br/>Sign in-toto"] --> E
    E["5. Review<br/>Replay checks and challenge evidence<br/>Sign in-toto"] --> F
    F["6. Qualify release<br/>Verify full chain, release bytes and approvals<br/>Sign in-toto"] --> G["Release<br/>Verify release signature and digest"]
```

Each attestation binds the checked output digest to its inputs, validation
evidence and predecessor. Where a stage uses an LLM, production and adversarial
validation can use independently selected models. A [typed decision advisor](docs/decision-providers.md)
can inform the validation gate. Deterministic policy controls advancement and
blocks the handoff when a required check, decision or signature fails.

The hosted APMX workflow replays the project checks and attests the checked
delivery. The Trail Desk Pages workflow authenticates the signed release
archive. Per-stage isolation, decision gates and signing are part of the target
workflow above. See [implementation and qualification status](docs/implementation-status.md).

## Start with a project

1. Install the [consumer blueprint](blueprint/README.md#install-in-an-application-repository) in your project. Author behavior and acceptance criteria in [specs/product-requirements.md](blueprint/specs/product-requirements.md). Select the approved stories and source paths in [request.md](blueprint/request.md) and configure the project-owned `.forge/verify-change` checker. The template exits unsuccessfully until you supply real checks.
2. Install APMX 0.8.0 and the Copilot CLI. Inspect the pinned contract graph from a clean copy of the reviewed project.

   ```sh
   apmx --from "richgo/forge-kit-skills/packages/software-factory#89eed7bdb145e8ec64ba08091968558cfee97daa" --plan
   ```

3. Follow the [APMX runbook](docs/apmx-factory.md) to run with an agent or configure GitHub Actions for independent replay and attestation. Review the exact patch and the evidence before accepting the change.

## Explore the examples

The [checkout reference](docs/reference-checkout.md) uses OpenSpec 2.0,
CALM/LikeC4 and independent acceptance across monorepo, multi-repo and
hybrid layouts.

| Example | What to exercise |
| --- | --- |
| [Python quote API, Go quote service and TypeScript price calculator](examples/consumers/README.md) | One approved discount behavior across three toolchains. Each project supplies its own protected checks for an unapplied source patch. |
| [Trail Desk change rehearsals](examples/trail-desk/rehearsals/README.md) | Exercise a product change that adds miles and an architecture change that serves the trail catalog through an API. |
| [Trail Desk release rehearsal](docs/hosted-rehearsal.md) | Trace a story through CALM, LikeC4 and browser acceptance, then inspect the evidence for a protected Pages release. |
| [Readiness fixture](docs/testing.md#readiness-and-catalog-fixtures) | Inject a faulty implementation and replay independent acceptance against the repaired result. |

## Documentation

- [Architecture](docs/architecture.md) and [components](docs/components.md) explain the lifecycle, interfaces and trust boundaries.
- [User guide](docs/user-guide.md) and [product requirements](docs/product-requirements.md) describe how to propose, build and review a change.
- [Verification guide](docs/testing.md) and [test catalog](factory/test/README.md) explain how to exercise and interpret the checks.
- [Implementation status](docs/implementation-status.md) records which paths are runnable and what each qualification covers.
