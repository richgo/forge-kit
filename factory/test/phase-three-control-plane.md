# Capability restore, checkpoints and replay

## Clean-room capability restore

The agent delivery workflow resolves the reviewed capability catalog and
restores the tracked APM lock from an empty install directory before
executing the planner, agent roles, or runner. Each runner checks the frozen
lock, APM audit, supported capability API, and installed runtime digests.
Product contracts, approval rules, repository-specific GitHub identity, and
release settings remain under the consumer repository's review boundary.

## Resume an interrupted qualification

Dispatch **Factory bootstrap** with `agent_products=true` and
`agent_resume_drill=true` from a trusted `main` ref, or as the repository owner on a reviewed branch.
Keep `pages_drill=false`.
The drill interrupts the evolution jobs after both initial revisions have
passed preflight, passed the producer secret scan, and saved their immutable
checkpoints. The initial jobs complete successfully before the injected
failure. An immutable interruption marker records which checkpoint was used
and prevents injecting the same failure again on a retry.

Rerun **failed jobs** on that run. The new attempt restores the original
initial checkpoint by run and product. It checks the source commit,
requirements and capability lock, recomputes the checkpoint digest, and
replays the initial acceptance cases before submitting source to the evolution
agent. The initial agent job does not run again. If a producer job is repeated
after it saved its artifact, it locates and reuses the unique same-run
artifact. Expired or ambiguous checkpoints fail closed. Start a new run
when intentionally changing inputs. Use failed-job reruns to preserve the
completed verifier and signing stages. Signing retries can create another
attestation for identical bytes. They cannot authorize a different release.

When preflight or review blocks a revision, the worker sends Jev a typed
failure class and the remaining one-repair budget. Missing, invalid, weak, or
escalating advice denies repair. The deterministic checker still gates any
candidate that the repair agent produces. No candidate source, acceptance
inputs, or expected outputs are sent to Jev.

## Replay the qualified source during a provider incident

In `richgo/forge-kit`, set `agent_replay_drill=true` together with the resume
drill to exercise the control plane without a live model dependency. This
qualification-only path requires the retained artifacts from the
[signed agent delivery run](https://github.com/richgo/forge-kit/actions/runs/42686477934).
It verifies the original signer workflow, commit, predicate and exact bundle
digest. It checks the original audit and rejects any requirements drift before
reusing source. The new attested bundle records the origin run, source commit
and bundle digest. The replay runs the current acceptance, scanner, signing,
reproduction and recovery controls. It does not create a new agent session or
authorize production deployment. Expired source artifacts stop the drill.

## Evidence and promotion

A runner without agent credentials independently validates CALM, LikeC4 and
acceptance. A separate security job scans the exact candidate source and
the selected immutable runtime image and generates a CycloneDX SBOM.
The promotion record binds verified bytes, the capability lock, runtime image,
scan and SBOM. See [the scan policy](supply-chain.md) for the severity gate and
runtime coverage. The signing job has OIDC and attestation write permissions
and does not execute agent output. The release job verifies both the signed
promotion record and the SLSA provenance against the workflow, source
commit and GitHub-hosted signer. It independently reproduces the verified
bundle byte-for-byte before simulating release and runtime recovery.
Reproduction starts from accepted source. Re-running a language model is
not part of the reproducible build.

The qualification workflow can only rehearse deployment in isolated runner
storage. The production Pages workflow uses the `github-pages` environment
and its existing concurrency and recovery rules. Production approval, live
publication and a live fault drill require the production environment policy
and separate authorization. No vulnerability waivers or deployment bypasses
are available in this qualification lane. Policy changes and capability
upgrades go through repository review.

## Operational limits

GitHub Actions artifact retention bounds resumability. The checkpoints are
immutable within a run, and their digests detect payload changes. The model
decision record and source are kept only after producer secret checks pass.
A clean scan covers configured secret patterns and the pinned runtime image
with the scanner database available for the run. It provides no guarantee
about unmodeled dependencies or vulnerabilities absent from that database.
