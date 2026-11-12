# Jev repair decisions

The readiness fixture sends TypeSafe one typed choice question. The request
state has three fields. `failure` comes from the approved failure vocabulary,
`used` is the number of retries already consumed, and `limit` is the attempt
cap. The runtime consults Jev only for a confirmed fixture readiness mismatch.
The live evaluation also sends synthetic unclassified and ambiguous cases to
measure the model's choices. The adapter rejects state with extra fields.
It sends the credential in the authorization header and caps the entire
request, including the response body, at five seconds.
[TypeSafe System One reference](https://docs.typesafe.ai/api/system-one)

The adapter accepts a typed `retry-build` or `escalate` answer from the pinned
model and validates its probabilities. Forge allows a retry only when the
selected retry probability is at least 0.8 and the local attempt, time, and
spend budgets permit it. The fixture allows one retry and starts a 15-second
repair window on the first eligible rejection. Each rebuild consumes one
local work unit, and the fixture budgets one unit per run. Jev billing is
managed in the provider account. The candidate must pass independent acceptance
before deployment. The runtime records the rejected artifact digest, advice,
budget and applied route in `repair-decisions.json`.

## Offline checks

Run `node --test test/decision-provider.test.mjs test/jev.test.mjs test/factory.test.mjs test/end-to-end.test.mjs`.
The [provider interface](../../docs/decision-providers.md) tests exercise a substitute provider without credentials and verify the CLI repair evidence. The Jev adapter cases
exercise the fixed endpoint, approved state, response validation, HTTP
failure, transport failure, and stalled response. The policy cases cover
confidence, attempted retries, elapsed time, and local spend. Runtime tests
verify that a denied repair cannot promote the rejected candidate.

## Credentialed check

Dispatch **Factory bootstrap** with `jev_probe=true` on an authorized ref,
with `FORGE_JEV_TOKEN` configured as a repository secret. For a local check
with the token already in the environment, run `node evals/jev-live.mjs`.
Inspect the `live-jev-repair` report for the HTTP status, typed recommendation,
expected route, and observed outcome.

| Case | Passing outcome |
| --- | --- |
| Confirmed fixture mismatch | Jev recommends retry with sufficient confidence. One rebuild passes independent verification. |
| Unclassified failure | Jev returns a valid escalation choice and policy escalates. |
| Ambiguous failure | Jev returns a valid choice and policy escalates. |
| Exhausted attempt or work-unit budget | The runtime escalates before consulting an advisor or promoting. |
| Stalled advisor | The runtime reaches its deadline and escalates without promotion. |

The live evaluation fails if any provider response is unavailable, malformed,
or misses its expected outcome. Offline transport and budget checks are kept
separate from the credentialed provider observations.

The repair adapter and deterministic budget policy are exported by the
pinned `repair-acceptance` APM package. Restore the APM lock before
running the contract tests. To test a separately checked-out revision
of the pinned catalog, set `FORGE_DECISION_PACKAGE` to its
`packages/repair-acceptance` directory.
