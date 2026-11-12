# Decision providers

ForgeKit uses a decision advisor for build repair and runtime recovery. The
advisor returns a recommendation. ForgeKit checks confidence, attempt and time
limits, and the evidence required to authorize an action.

## Select a provider

Set `FORGE_JEV_TOKEN` to use the built-in Jev adapter. To use another provider,
set `FORGE_DECISION_PROVIDER_MODULE` to the path of a trusted JavaScript module
on the runner. The configured module takes precedence. Provision it from a
reviewed revision outside the candidate's workspace. The adapter owns provider
credentials, model selection and transport.

## Implement an adapter

Export the following functions. Each can return `{ choice, probability }`
synchronously or asynchronously. Use a finite probability between zero and
one, or return `null` when advice is unavailable.

| Export | State fields | Allowed choices |
| --- | --- | --- |
| `recommendRepair(state, { timeoutMs, signal })` | `failure` is `readiness-mismatch`, `unclassified-failure` or `ambiguous-failure`. `used` and `limit` are attempt counts. | `retry-build`, `escalate` |
| `recommendRuntime(state, { timeoutMs, signal })` | `failure` is `confirmed-content-mismatch` or `unconfirmed`. | `restore`, `retry-observation`, `escalate` |

Use the supplied `AbortSignal` to cancel provider requests. ForgeKit caps each
call at five seconds and withholds advice on errors, timeouts and invalid
responses. Each call receives only the state fields listed above. For local
and hosted verification, see the [decision tests](../factory/test/jev.md).
