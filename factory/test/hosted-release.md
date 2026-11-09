# Hosted release and attestation

Forge Factory E2E uses the APM catalog to resolve the immutable worker
revision. It restores the reviewed lock with APM 0.33.0 in a separate job
and audits the installed files before the build starts. The build and verifier independently hash-check and restore the resulting module archive. The release attestation binds both the package lock and that exact archive. The worker then builds Trail Desk, invokes the
pinned APMX contract with Copilot, and independently checks CALM, LikeC4,
browser acceptance, security and the APMX output. A separate job regenerates the impact plan from the approved inputs.

The verifier packages the exact Pages tarball. A separate attestor signs
its digest in an in-toto statement with the source revision, APM lock
hash, independently replayed APMX receipt hash and acceptance report
hash. Before deployment, another runner verifies the GitHub signature,
worker path and exact worker commit, source ref and commit, runner
identity and predicate type. It compares the signed evidence hashes
against the checked artifacts and lock. Pages consumes the same
immutable archive after verification and its deployment environment gate.

## Run and inspect

1. Run `node --test` in Forge Kit. This includes a check that the release
   workflow and capability manifest use the same worker pin.
2. Run `node --test` in the pinned `richgo/forge-kit-skills` checkout. Its
   hosted workflow tests check the archive handoff, separate packaging
   paths, frozen assembly, signature constraints and evidence binding.
3. Dispatch **Forge Factory E2E** with `publish_pages=false` as the repository owner on a reviewed
   branch. The repository needs `COPILOT_GITHUB_TOKEN` and access to
   GitHub artifact attestations. Inspect `factory-verified`,
   `factory-pages-signature`, and `factory-release-proof`.
4. Dispatch with `publish_pages=true` from `main` to exercise the Pages
   environment and HTTPS observation. Only run this against the
   intended deployment environment. Download
   `factory-pages-observation` to compare the live file digests.

In a qualification run, a missing artifact, signature or independently
replayed report must fail the worker. A changed archive, wrong signer
path or revision, mismatched source, or changed evidence hash must fail
authentication before the Pages job becomes eligible. Local tests
exercise workflow wiring. An actual hosted qualification is needed to
verify GitHub signing and certificate identity.

The reference rehearsals are separate workflows. Their evidence cannot
qualify a production Pages release. This gate covers F-E2E-06 and
F-E2E-10 for the hosted Trail Desk path. Runtime recovery is tracked
separately from signature qualification.

## Recover a failed Pages deployment

Select `rollback_run_id` from a successful **Forge Factory E2E** deployment
from `main` whose signed release is still live. The candidate plan uses that
run's source as its comparison base. Before it publishes, the deployment
job validates the prior run identity and archive signature, compares the
retained observation against the prior manifest, and probes the active
site again. An expired, unverified or stale fallback blocks publication.

If deployment or observation fails, the job makes one attempt to redeploy
the authenticated prior archive and re-probes the restored files. The
candidate run stays failed, even after a confirmed recovery. Download
`factory-pages-recovery` to see the candidate and restoration outcomes.
A cancelled job or failed restoration requires operator intervention.

The archive and signature are retained for 90 days on the repository's
current Actions settings. For a first signed release or deliberate
break-glass publication, set `allow_publish_without_rollback=true` and
leave `rollback_run_id` empty. This explicitly waives automated rollback
for that release. The repository's `github-pages` environment controls
deployment access.

For isolated worker qualification, the repository owner can also set
`qualify_worker_only=true` with `publish_pages=false`. This runs the
same pinned worker, APM restore, Copilot APMX contract, independent
checks and signature tests. It omits the GH-AW dispatcher and never
qualifies a Pages deployment.
