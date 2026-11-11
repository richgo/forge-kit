# Runtime observation boundary

Run `node --test test/runtime.test.mjs test/pages.test.mjs test/pages-integration.test.mjs`.

`factory/runtime.mjs` provides a bounded observer for an authenticated release identity. The caller supplies an HTTPS Pages URL, the expected 64-character release digest from trusted release evidence, and positive integer limits `maxFailures` and `maxChecks` (each at most 100). The default probe is `checkPublished` from `factory/pages.mjs`, which verifies the served release manifest and exact HTML digest. A supplied `onObservation` callback can persist each observation to an external audit system; callback errors propagate rather than being treated as success.

Two consecutive mismatches with `maxFailures=2` trigger escalation. A successful probe resets the consecutive failure counter. When the check budget ends, the monitor returns healthy only if its final observation is healthy; otherwise it escalates. It does not retry forever, change release bytes, deploy, sign evidence, invoke Jev, or trigger rollback. An orchestrator must authenticate a release with verified evidence and use the existing gated deployment/recovery workflow before any restoration. Never grant an observation-only identity Pages write permission.

These tests exercise real policy transitions and inject probe outcomes at the network boundary; they are not proof of a continuously scheduled production monitor. Production rollout additionally requires a scheduled trigger, durable audit sink, alert delivery, and a live controlled-failure rehearsal.
