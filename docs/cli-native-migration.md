# CLI-native migration: executable retirement gates

The **production blueprint** must not invoke `node factory/*.mjs`, `node
evals/*.mjs`, or any copied JavaScript factory runtime. Application code in
examples may use any language. The current legacy factory remains a
reference until native replacements satisfy all protected behaviors.

## Ownership

- **APMX** owns contract scheduling, agent execution, bounded attempts,
  producer outputs, independent contract replay and evidence.
- **APM** owns immutable installation and resolution of agent skills and
  configuration; the consumer pins packages and lockfiles.
- **Project tools** own language-specific compilation, tests, architecture
  validation and security acceptance through a reviewed checker.
- **GitHub Actions** owns protected approvals, deployment environments,
  attestations, incident workflow triggers and audit artifacts.
- **Decision APIs** own machine-checkable policy decisions. A generative
  agent's narrative is never authorization to deploy or restore.

## Native replacements and retirement gates

| Legacy group | Native target | Required evidence before removal |
| --- | --- | --- |
| `factory/cli.mjs`, `assembly.mjs`, `agent-*.mjs` | APMX contracts and CLI | Three different consumer stacks produce checked patches with hosted signed replay |
| `factory/architecture-plan.mjs`, `impact.mjs`, `slice.mjs` | Pinned CALM/LikeC4 CLIs and architecture contracts | Valid/invalid models, interface change and impact regression fixtures pass |
| `factory/supply-chain.mjs`, `agent-verifier.mjs` | Native scanners, protected tests and GitHub attestations | Adversarial tamper tests and verified provenance |
| `factory/pages.mjs`, `website.mjs` | Product-owned release adapter and CLI | Live candidate, authenticated baseline, failure injection, rollback and independent re-observation |
| `factory/runtime*.mjs`, `recovery.mjs`, `decisions.mjs` | Typed decision API + privileged workflows | Replay-safe incidents, bounded retries, idempotency, race and tamper tests |
| `factory/test/*.mjs`, `test/*.mjs`, `evals/*.mjs` | Native CLI acceptance and contract conformance | Equivalent regression evidence and CI coverage |

**Never remove a group solely because its replacement parses or prints a
successful message.** It must execute the same security invariant on
independent, immutable evidence. Retain the previous working deployment path
until a separately approved cutover.

## Migration sequence

1. Freeze the current behavioral and adversarial test inventory.
2. Qualify the APMX blueprint on Python, Go and TypeScript consumers.
3. Replace architecture validation and independent test runners with pinned
   CLI invocations, preserving CALM/LikeC4 semantics.
4. Replace release, monitoring and restoration adapters with independently
   authenticated native tools and privileged GitHub workflows.
5. Remove the legacy runtime in bounded groups; prove each deletion does not
   reduce coverage or relax protected permissions.
6. Clean-room install from immutable package references; perform two complete
   product lifecycles and a controlled failure/recovery rehearsal.

The checker template intentionally fails until the consumer configures
real checks. Do not convert it to a success stub to make CI green.
