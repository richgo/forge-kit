# ForgeKit architecture

ForgeKit composes a software factory from versioned APM packages, APMX contracts and project-owned checks. The factory treats application code as an input to the workflow. Bash and Git provide the patch-checking interface, and the project chooses the application runtime and build tools.

## Change and delivery lifecycle

1. **Approve intent.** Describe the outcome, allowed source scope, protected behavior and observable acceptance criteria. Link the story and architecture revisions that define the change.
2. **Resolve the workflow.** Pin the APMX CLI and factory package. APMX resolves the declared contract inputs and outputs into an execution plan. Projects using installed agent capabilities pin those packages and their dependencies with APM.
3. **Build a candidate.** The plan and specification guide the agent. The build contract exports an unapplied Git patch and an implementation report. The agent works within the approved scope and a bounded attempt and time budget.
4. **Check independently.** Run the approved project's `.forge/verify-change` against the exact patch. Check allowed paths, apply the patch to a disposable copy of the approved base and run the required build, architecture, acceptance, regression and security checks. A failure blocks delivery.
5. **Record evidence.** Inspect the advisory review and the checked patch. The hosted workflow replays the checks in a separate job and attests the checked delivery and binds it to the receipt.
6. **Operate through a protected release workflow.** A product's release adapter authenticates the approved artifact, checks environment policy and observes the deployed result. Recovery policy may authorize a bounded restore of an authenticated fallback. Probe the restored release and escalate if its health cannot be confirmed.

## Architecture as an input

CALM models describe components, interfaces and relationships. A LikeC4 view makes the relevant structure reviewable. Use native validation and project rules to keep the models aligned. The impact assessment connects changed nodes and downstream consumers to the acceptance criteria that need replay. A project can use other architecture tools through the same checker interface. [Blueprint architecture guidance](../blueprint/architecture/README.md)

## Authority and evidence

The approved base supplies requirements, check definitions and expected results. Candidate code executes with only the resources it needs, outside the agent workspace and without signing or deployment credentials. A trusted check result binds the candidate to its approved inputs. The release job authenticates that evidence before it can use privileged credentials.

Typed decision APIs such as Jev can recommend a retry or escalation. Deterministic policy owns the allowed actions, confidence threshold, attempt and time budgets, and escalation conditions. A repair that changes the approved requirements, architecture or capability set goes back through review.

See [component interfaces](components.md), [verification](testing.md) and [implementation status](implementation-status.md).
