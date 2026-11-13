# ForgeKit

ForgeKit is a CLI-native, language-agnostic software factory. It turns an approved product or architecture request into a source patch that a project's independent checks can accept for review. APM installs versioned capabilities, and APMX runs the contracts that turn the request into a plan, specification, implementation and review.

The project owns its language, toolchain, architecture, acceptance criteria and release policy. ForgeKit defines the handoffs between the agent that proposes a change, the verifier that checks it and the operator who can authorize publication.

## From change request to release

The hosted workflow starts from the approved project revision. The product
requirements define the stories and checks. When present, the reviewed
OpenSpec change defines the behavior delta and maps selected acceptance IDs
to scenarios. APMX runs the pinned plan, specification, build and review
contracts. A separate job independently replays the checks before signing
the delivery.

```mermaid
flowchart LR
    P["Approved request and product stories"] --> A
    T["CALM, LikeC4 and OpenSpec change"] --> A
    A["Validate reviewed inputs"] --> B["APMX plan and specification"]
    B --> C["Build and advisory review"]
    C --> D["Independent replay"]
    D --> E["Sign checked delivery"]
    E --> F["Product release policy and observation"]
```

For a change spanning services, a reviewed `ProductChange` plan pins the
shared specification and each implementation unit. Qualify the combined
artifacts against architecture, API compatibility and system acceptance.
See the [checkout runbook](docs/reference-checkout.md) and
[implementation status](docs/implementation-status.md).

## Start with a project

1. Install the [consumer blueprint](blueprint/README.md#install-in-an-application-repository) in your project. Author behavior and acceptance criteria in [specs/product-requirements.md](blueprint/specs/product-requirements.md). Select the approved stories and source paths in [request.md](blueprint/request.md) and configure the project-owned `.forge/verify-change` checker. The template exits unsuccessfully until you supply real checks.
2. For OpenSpec changes, follow the [OpenSpec setup and binding guide](docs/reference-checkout.md#author-and-verify-an-openspec-change). Install APMX 0.8.0 and the Copilot CLI, then inspect the pinned contract graph from a clean copy of the reviewed project.

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
