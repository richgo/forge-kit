# Hosted end-to-end rehearsal

Enable GitHub Pages with **GitHub Actions** as its source and restrict the
`github-pages` deployment environment to the approved release branch.
**Factory bootstrap** runs the tests, verifies the two synthetic story
revisions in an independent job, and builds their public static release
artifacts. No product source, secrets, or non-fixture data goes to Pages.

Run **Factory bootstrap** manually with `pages_drill` enabled. It publishes
the verified baseline, publishes a distinct verified candidate, and
redeploys an identical copy of the baseline. It fetches both the live HTML
and the release manifest after each deployment and validates the expected
digests. The `hosted-release-evidence` artifact records all observations.
The deployment job serializes runs and attempts baseline recovery after a
candidate failure. If a run is interrupted, dispatch with `pages_drill`
and `pages_restore_only` to publish the checked baseline again.

Enable `jev_probe` to exercise the optional live repair decision against
the synthetic faulty build. This separate read-only job requires
`FORGE_JEV_TOKEN`. It verifies the observed retry or escalation and
checks that the policy always escalates after the retry budget is spent.

Run **APMX package rehearsal** with `live_story` enabled to verify the
same baseline story through the pinned native APMX runner, its separate
check job, and GitHub artifact signing. CI compares the checked-in
rehearsal inputs with fresh independent outputs before publishing.
The live story and **Catalog reference rehearsal** require the repository's
`COPILOT_GITHUB_TOKEN`. The latter runs the pinned read-only GH-AW catalog.

`FORGE_REHEARSAL_REF` is an optional repository variable for a reviewed
branch rehearsal. Pages still requires the matching deployment environment
branch rule. Remove the exception after the rehearsal; ordinary releases
use the default branch.

Pages tests the static release and the public HTTP serving path. The
delegated Node worker and runtime repair tests run on Actions runners.
