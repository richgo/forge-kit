# Phase 1 Pages qualification and incident recovery

The production release worker in `richgo/forge-kit-skills` remains pinned by
`factory/packages.json`. It independently checks the APMX contract, CALM,
LikeC4, browser acceptance, and security evidence. It authenticates the
archive's GitHub attestation and compares the signed predicate to the evidence
before granting Pages deployment. Keep the existing release gate and
`github-pages` environment protections in place.

## Enable production observation and recovery

1. Identify two successful `Forge Factory E2E` publications from `main` with
   unexpired `factory-pages`, `factory-pages-signature`, and
   `factory-pages-observation` artifacts. The newer release must be active.
   Set `FORGE_RUNTIME_CANDIDATE_RUN` to its run ID and
   `FORGE_RUNTIME_BASELINE_RUN` to the approved healthy predecessor's run ID.
   Update the pair after each approved release. The repository setting is an
   operator selection of the predecessor. Signatures and health are independently
   checked against the selected runs and the repository's Pages URL.
2. Run **Qualify Pages runtime and recover incidents** on `main`. It also runs
   every three hours. A candidate run ID switches monitoring from the original
   readiness-fixture monitor to the Trail Desk manifest and all three published
   files. In observation mode, failed checks create a GitHub issue and fail
   the workflow for review. Subscribe the responsible operators to repository
   issue notifications and workflow failures, and verify delivery as part of
   qualification.
3. After validating the environment and authorizing automated restoration,
   configure the `FORGE_JEV_TOKEN` secret and set
   `FORGE_RUNTIME_RECOVERY_ENABLED=true`. Restrict `github-pages` to trusted
   refs and use the required environment protection policy. If the environment
   requires a reviewer, the job pauses there before it can restore.

The detection job has read permissions. A separate issue job records an
incident before the privileged job can run. Inside the deployment environment,
the worker independently downloads and verifies both archives against the
historical source SHA, caller repository, trusted signer workflow and its
historical pin, GitHub-hosted runner, and Pages predicate. It compares retained
observations to the authenticated manifests. It never consumes an archive,
identity, or authorization produced by the observer job.

The worker asks Jev for a typed decision using a single enumerated failure
signal. An unavailable manifest, an unknown release, weak advice, or an
unhealthy or unverified predecessor routes to an issue. A retry permits one
additional read-only probe. Restoration requires two consecutive content
mismatches with the active candidate manifest, an approved recommendation
with probability at least 0.8, deterministic authorization, and another
matching incident observation immediately before reserving the attempt.

## Budget, audit and incident ownership

Publication and recovery share the repository's `github-pages` concurrency
group. GitHub can replace a queued job with a newer pending job. Re-check the
current deployment and workflow status when an operation is cancelled while
queued. Keep other Pages publishers disabled or serialized in the same group.

The worker allows one deploy attempt per candidate publication run. Its durable
claim is a GitHub Actions bot comment on the issue. The claim is persisted
before Pages can receive the archive. A crash, timeout, cancellation, or
ambiguous deploy response after the claim consumes the attempt. Preserve the
bot issue and comments, including closed issues. Restrict issue moderation
and configuration to trusted operators. A workflow rerun reads the original
claim. The worker checks the predecessor if the candidate manifest has
changed so a healthy restoration remains recognizable until the configured
run IDs are updated.

The issue links the run. The detection and recovery artifacts retain
authenticated manifests, archive hashes and signature verification for 90
days, with observations, Jev's typed choice, the policy result and the
post-deployment probe where applicable. After a Pages deployment reports
success, a fresh HTTPS probe verifies the predecessor manifest and file
digests while the deployment lock is still held. Review the issue if recovery
is cancelled or the final probe fails. Retention expiry requires selecting
eligible run IDs again. A total outage or unreadable release identity requires
operator investigation because the worker cannot establish which release is
active.

## Qualification evidence and remaining live gates

- The ForgeKit tests inject corrupt HTML and CALM/LikeC4 bytes through the
  public probe interface, exercise retry and escalation, and verify healthy
  predecessor observation after simulated restoration. Skills tests exercise
  the typed Jev transport, invalid responses, and existing build-repair behavior.
- The pinned worker's no-deploy qualification signs the archive and tests
  rejection of changed archive bytes and a wrong signer revision. See
  [hosted release qualification](hosted-release.md).
- Production acceptance requires two qualified historical publication runs
  and an authorized deployment environment. Rehearse the protected
  environment and the full incident path on an isolated Pages target with
  authorized failure injection before a live exercise. Retain both release run
  IDs, the incident issue, the signed archive digest, the authorized deployment
  outcome, and the final HTTPS observation.
- The production monitor, Jev endpoint response in the recovery job, issue
  notification delivery, Pages restoration, and a controlled live failure
  require hosted environment evidence before claiming live qualification.
