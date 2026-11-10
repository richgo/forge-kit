# Blueprint conformance

A consumer qualifies the blueprint by proving that its independent
`.forge/verify-change` rejects malformed and unauthorized patches,
enforces the protected architecture and acceptance suites, and accepts a
legitimate implementation. The factory must also pass an APMX `--plan` run,
an actual agent execution, independent hosted replay, and artifact attestation.

The shipped template is intentionally fail-closed and cannot be used to
certify any product. End-to-end release and runtime recovery must be qualified
separately before production use.

> **Migration:** The native blueprint is the recommended path, but hosted multi-language and production recovery equivalence are not yet proven. See [implementation status](../../docs/implementation-status.md).
