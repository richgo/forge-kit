# Authenticate the stage chain

The release verifier must consume six receipts, in this order: admit, plan,
specify, build, review and qualify. Each receipt binds its input, output,
evidence, predecessor receipt, independent check and policy decision.

`factory/authenticate-stage-chain.mjs` authenticates these files with GitHub
CLI's Sigstore verifier before checking the chain. The reviewed trust file
pins the repository, workflow source commit and ref, run ID and run attempt,
and each stage's signer workflow and commit. Do not load trust settings from
the downloaded delivery or its receipt.

```sh
node factory/authenticate-stage-chain.mjs \
  --directory downloaded-stage-evidence \
  --trust reviewed-stage-trust.json \
  --approved-base "$APPROVED_BASE_SHA256" \
  --release-digest "$RELEASE_SHA256"
```

The evidence directory contains `<stage>.json` and `<stage>.sigstore.json`
for each stage. Each receipt includes string `runId` and `runAttempt` fields.
Compute its `receiptDigest` over `JSON.stringify(receiptWithoutReceiptDigest)`.
The in-toto predicate type is
`https://github.com/richgo/forge-kit/attestations/stage-receipt/v1`.
Its predicate binds `receiptDigest`, `runId` and `runAttempt`; its single
subject binds the complete receipt file's SHA-256.

Trust file shape:

```json
{
  "repository": "richgo/forge-kit",
  "sourceDigest": "<40-character reviewed source commit>",
  "sourceRef": "refs/heads/main",
  "runId": "123",
  "runAttempt": "1",
  "stages": {
    "admit": { "workflow": "richgo/forge-kit/.github/workflows/admit.yml", "digest": "<40-character signer commit>" },
    "plan": { "workflow": "richgo/forge-kit/.github/workflows/plan.yml", "digest": "<40-character signer commit>" },
    "specify": { "workflow": "richgo/forge-kit/.github/workflows/specify.yml", "digest": "<40-character signer commit>" },
    "build": { "workflow": "richgo/forge-kit/.github/workflows/build.yml", "digest": "<40-character signer commit>" },
    "review": { "workflow": "richgo/forge-kit/.github/workflows/review.yml", "digest": "<40-character signer commit>" },
    "qualify": { "workflow": "richgo/forge-kit/.github/workflows/qualify.yml", "digest": "<40-character signer commit>" }
  }
}
```

The workflow names above illustrate the trust schema; they are not supplied
stage runners. Receipt claims of independent verification and policy approval
are meaningful only when the pinned signer workflow actually performs those
checks outside the producer job. The existing APMX factory does not yet
produce this six-stage format. This verifier is a release-side component,
not evidence of completed hosted P0 qualification.

Run the offline security tests with:

```sh
node --test test/stage-chain.test.mjs test/authenticate-stage-chain.test.mjs
```

The tests exercise the command boundary with a substitute signature process;
a real signed hosted run remains required to qualify the integration.
