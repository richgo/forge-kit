# Architecture inputs

Keep the project's architecture models with its approved source and link the
relevant components and interfaces from [the product requirements](../specs/product-requirements.md).
With CALM and LikeC4, use CALM for machine-readable nodes, interfaces and
relationships and LikeC4 as the reviewable view of the relevant structure.
Projects can provide other architecture inputs through the same checker.

In [.forge/verify-change](../.forge/verify-change), check the proposed patch
against the permitted source scope and validate the candidate's architecture
in a disposable tree. Run pinned validators for the project's model and view.
Add project rules for changed interfaces, forbidden dependencies, data flows
and any downstream behavior the change can affect.

For an architecture change, test the intended structural result as well as
the public behavior. The [delegated readiness fixture](../../factory/test/architecture-impact.md)
uses an independent check to observe the worker process while verifying the
same readiness response.
