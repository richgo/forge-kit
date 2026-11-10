# Agent release supply-chain checks

The producer scans both accepted source revisions and the audit before
uploading candidates. A separate verifier scans the accepted bundle again
and scans the exact Linux/amd64 runtime image pulled by its digest. Both jobs
use the official Trivy 0.76.2 binary. The installer verifies the reviewed
release-asset checksum before unpacking it.

A private temporary directory holds candidate files and raw scanner reports.
Only a secret count can leave that directory. Scanner failures never print raw
diagnostics. The runtime report records the concrete image ID, operating
system, detected package count, vulnerability IDs and severities, and the
database freshness and digest. The CycloneDX inventory contains the scanned
runtime components and SHA-256 hashes for both source revisions.

Signing requires a clean secret scan and no CRITICAL runtime finding with a
published fix. Unfixed CRITICAL findings and all other severities remain in
the evidence. A missing, malformed, or more than 72-hour-old database blocks
promotion. The scanner covers packages and manifests Trivy detects in the
selected image, as well as supported secret patterns in generated source and
audit text. External runtime services, agent tool credentials, arbitrary
secret formats, and upstream binaries without a detected package record are
outside this check.

The signing job attests the reviewed promotion manifest. It binds the exact
verified bundle, source commit, frozen APM lock, approved image and platform,
security report, and CycloneDX SBOM. The release job authenticates the
attestation before checking those bindings and re-applying the gate. An
unavailable scanner or database prevents signing. Raw scan output and source
with detected secrets are excluded from artifacts.

## Runtime image qualification

On 9 November 2026, a Trivy 0.76.2 registry scan of the agent delivery
`node:22-bookworm-slim` digest `e21fc383…` on Linux/amd64 reported four
fixable CRITICAL findings. The IDs were CVE-2026-13221, CVE-2026-42496,
CVE-2026-8376, and CVE-2026-59873.

The replacement official Node digest `5ec23b7c…` and the existing official
`python:3.13-slim-bookworm` digest `a5a7017e…` each had zero fixable
CRITICAL findings using the same database. This is a point-in-time result.
The hosted gate scans the locally pulled immutable image and applies the
current database again.

Run `node --test test/supply-chain.test.mjs` for the deterministic policy
and evidence regressions. Set `FORGE_TEST_TRIVY` to a checksum-verified
executable to also exercise real secret detection with a synthetic credential.
