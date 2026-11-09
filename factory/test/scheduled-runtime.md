# Scheduled release observation

The `Observe verified Pages release` workflow runs every three hours on the default branch and can be manually dispatched. It is **read-only**. The job invokes `factory/monitor-cli.mjs`, which uses the actual Pages manifest and HTML digest probe and a finite policy of three checks, escalating after two consecutive failures. The job writes a JSON incident/observation record and retains the workflow artifact for 90 days. Escalation fails the job; GitHub Actions notifications or external alert routing must be configured by operators.

## Trusted baseline setup

After a successful, independently authenticated Pages deployment, take these values from the verified release manifest/evidence, and configure GitHub repository variables: `FORGE_PAGES_URL` (HTTPS site root), `FORGE_EXPECTED_RELEASE` (64-character release digest), `FORGE_EXPECTED_INDEX_SHA256` (64-character HTML digest), and `FORGE_EXPECTED_SOURCE` (40-character source commit). Update them **only after** the new release has passed its signature verification, publication and observation gates. Never learn the expected digest from the currently served public manifest: that would make an attacker-controlled publication its own acceptance oracle.

If any baseline variable is missing, the scheduled job fails closed. No release, rollback or repair can be triggered by the read-only workflow. A failed observation requires an operator or separately authenticated, gated recovery workflow. The expected baseline variables are not cryptographically authenticated by this monitor; repository-variable write access is therefore a security boundary.

## Tests

Run `node --test test/monitor-cli.test.mjs test/runtime.test.mjs test/pages-integration.test.mjs`. Tests cover configuration rejection, evidence persistence, escalation, bounded monitoring, URL restrictions and read-only workflow permissions. A passing local suite is not evidence that the scheduled workflow has successfully observed a live production release. Production acceptance requires configuring the trusted baseline and observing a successful scheduled run, followed by an authorised controlled-failure rehearsal.
