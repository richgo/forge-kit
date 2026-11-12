# Capability catalog and restore

ForgeKit assembles the packages listed in [the reviewed role manifest](../packages.json). The generated APM manifest and lock describe the complete package restore. Each dependency uses a full Git commit and the agent delivery loader also checks its export API and the SHA-256 of every runtime module before importing it.

| Capability | Catalog location | Consumer boundary |
| --- | --- | --- |
| Agent delivery | `packages/agent-delivery` | Versioned architecture planner, agent roles and isolated verifier. ForgeKit provides product inputs, checkpoints and job permissions. |
| Requirements | `packages/requirements` | Product specification prompts, review agent and independent requirement checker. |
| Architecture | `packages/architecture` | CALM skill and reference-slice impact checker. |
| Acceptance | `packages/acceptance`, `packages/website-acceptance` | Acceptance skills, a reusable website review prompt, and reference rehearsal contracts. |
| Build and repair | `packages/build-repair`, `packages/repair-acceptance` | Repair prompts, diagnosis skills, typed Jev decisions and independent evidence checks. |
| Delivery and security | `packages/delivery`, `packages/security-review` | Signed handoff and rollback primitives, website security skill and review agent. |
| Orchestration and tools | `packages/factory-workflows` | Compiled GH-AW reusable workflows, reference lifecycle and restricted tool declarations. |

The lock's `deployed_files` and deployment ledger inventory each installed skill, agent, prompt and other APM primitive, with its owning package and file digest. The generated dependency map names the exact repository, subdirectory and Git revision for every role. For non-deployed contracts and tools, inspect the selected package's `exports.json`, `.apm`, `contracts` and workflow directories. `git ls-files .github/workflows factory` inventories the consumer's event bindings, runtime gates and release policy. Product fixtures and production environment rules are specific to this installation.

## Restore and audit

Start from a clean checkout on Linux and run:

```sh
node factory/cli.mjs assemble
bash factory/restore-capabilities.sh
node factory/agent-capability.mjs
```

The restore downloads the architecture-matched APM 0.33.0 release and checks the archive checksum. It verifies that assembly reproduces `apm.yml` byte for byte, runs the locked install and audit in a scratch project, checks that the lock did not change, validates the runtime files, and atomically publishes the restored modules into the workspace. It rejects a pre-existing module path. An operator can pass an independently reviewed APM 0.33.0 executable instead of fetching it. APM audit verifies lock consistency, deployed content and install replay in the scratch project. Repository policy is additionally enforced by the reviewed role manifest and package loader.

`FORGE_AGENT_DELIVERY_PACKAGE` may point at an independently restored local package root for development. Its bytes and export API must match the reviewed manifest. The package report can be retained with release evidence without capturing credentials or the workspace path.

## Add, upgrade and roll back

1. In a disposable project, inspect the proposed package at a full SHA with `apm view` and review its exported primitives. APM 0.33.0 adds a package with `apm install <package>#<sha>`. Avoid mutable tags or branches for the resulting selection.
2. Update the affected capability role in `factory/packages.json`. For the agent delivery runtime, preserve API 1 or update the loader and compatibility tests in the same change. Review the four SHA-256 values from the proposed checkout.
3. Regenerate `apm.yml` using `node factory/cli.mjs assemble --apm`. In a clean Linux scratch project run `apm install --target copilot` to regenerate the lock. Review the complete manifest and lock diff before accepting it.
4. Run the frozen restore, package audit, and integration checks on a clean checkout. Roll back by selecting the previous reviewed pin and matching lock and digest set, then rerun the same checks.

To revoke a compromised package, add its full `repository/path#sha` reference to `revoked` in the role manifest and select a reviewed replacement. Assembly rejects a revoked selection, including for a rollback or rehearsal. This policy is revisioned with the consumer checkout. Older checkouts retain their historical policy and must be removed from the set of authorized dispatch refs if a pin is compromised.
