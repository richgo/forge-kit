# Factory verification and evals

The suite uses two boundaries. Forge Kit's CLI cases start from product
requirements, authoritative CALM and a LikeC4 view. Catalog cases run the
pinned package's independent acceptance, signing and deployment code in
a separate temporary environment.

| Scenario | Expected evidence |
|---|---|
| Same product requirement, new CALM worker | The requirement digest and readiness response stay the same. The plan selects a worker, the artifact digest changes, and a real child process emits the worker marker. A direct implementation with a recomputed digest still fails delegated acceptance. |
| Changed product requirement, same architecture | The architecture and view digests stay the same. The runtime returns the updated response. The verifier rejects the new artifact under the original requirement. |
| Stale view, unknown owner, or reversed CALM edge | The run stops before building a candidate. |
| One faulty source revision | A known mutation builds valid JavaScript that prints the wrong response. It runs and fails acceptance before deployment. The rebuilt source passes, and the receipt binds both the rejected and deployed bytes. |
| Persistent faulty source | Both attempts fail. The factory escalates after one retry with no deployment or success receipt. |
| Tampered evidence or a false review claim | The verifier detects edited artifact bytes. The deterministic grader rejects wrong digests, unsupported signer or environment claims, and extra claims. |
| Catalog receipt or delivery failure | The pinned catalog checks an independent signature and rejects the wrong signer or bytes. An additional scenario corrupts deployed bytes and confirms that rollback restores the previously observed release. |
| Typed routing and package integrity | Missing, malformed or untrusted decision signals cannot authorize deployment. GitHub CI reproduces the APM lock in a fresh directory. |

## Run the suite

```sh
node --test
```

To reproduce the delegated repair case manually, use a fresh output directory.

```sh
mkdir -p out/inputs
cp examples/requirements.json test/fixtures/delegated/architecture.json test/fixtures/delegated/architecture.c4 out/inputs/
node factory/cli.mjs run out/delegated --inputs out/inputs --fault wrong-output-once
node factory/cli.mjs verify out/delegated --inputs out/inputs
```

The checker job in GitHub uses a fresh copy of the approved requirements and
architecture from its own checkout. It downloads only the producer's
outputs. Locally, keep the approved inputs available for independent replay.
The fixture accepts a constrained Node implementation and executes only exact
matches of its known templates. The code mutation is confined to fixture
runs and cannot change package policy or the requirements.

The deterministic review grader accepts a JSON report with six fields.
`verdict` is `review-ready`, `subject` is the deployed SHA-256,
`requirement` is the requirement ID, `repairs` is the retry count,
`signed` is false, and `environment` is `local`. Supply a review from the
reviewer or model, then score it against a verified receipt.

```sh
node factory/cli.mjs grade out/delegated --inputs out/inputs --review review.json
```

The grader returns structured pass/fail results and exits unsuccessfully
when any assertion fails. The local in-toto Statement is unsigned. The
catalog rehearsal uses its separate signed handoff.

## Credentialed evaluation

Run live cases in disposable repositories and isolated deployment
environments. Pin the model, catalog, requirement revision and architecture
revision for each trial. Keep the independent tests and acceptance policy
in the trusted checker revision. Inject the defect into the candidate
source or a disposable deployment after promotion. Give the repair agent
the observed symptom and candidate revision, with the accepted requirements
and architecture read-only.

Record first-attempt acceptance, repair success within budget, rollback
success, unsafe promotion count, evidence coverage, and elapsed time per
case. Keep every failed attempt. Grade the result against independent
observations. Any unsafe promotion blocks release regardless of aggregate
scores. For live Jev, replay cases with clear retry and escalation outcomes,
ambiguous inputs, and provider failures. The typed route is advisory, and
the same deterministic limits apply across providers.

The automated suite covers the reference fixture and pinned catalog code.
The credentialed APMX and GitHub Agentic Workflow trials and live Jev evals
still need a configured disposable target and the relevant credentials.
Use the existing manual rehearsals to verify hosted execution separately
from these pull-request checks.
