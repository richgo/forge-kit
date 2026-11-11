# Trail Desk release and hosted rehearsals

Trail Desk demonstrates a product-specific release adapter. For a project
that needs a checked source patch, use the [APMX factory runbook](apmx-factory.md).

## Verify the Trail Desk release

Open **Actions → Forge Factory E2E → Run workflow** on the default branch.
The GitHub Agentic Workflow uses its `call-workflow` safe output to start
one pinned worker. The workflow fails if the worker is skipped or fails.
The worker reads the original dispatch, executes the Forge Kit CLI, runs
the pinned APMX contract against that candidate, and replays both the
runtime and APMX checks in a fresh job before signing.

Select `website_release=current` and keep `publish_pages=false` for a
verification-only run. Publication requires an explicit dispatch from
`main` and an approved Pages environment. Follow the [release gate runbook](../factory/test/hosted-release.md)
for fallback authentication and observation.

Download `factory-verified` for the independent Chromium observations,
requirements trace, and in-toto receipts. `factory-pages-observation`
records the HTTPS checks of the public site and architecture files.

## Review a Trail Desk change

Trail Desk is a fictional trail directory. Its reviewed product
requirements are under `examples/trail-desk` in `product-requirements.md`.
Each revision has a reviewed `catalog.json` for trail data and `acceptance.json`
for independent browser assertions. The factory generates CALM, projects the
LikeC4 view from the CALM graph and builds the static site.

For a product change, edit [the current Markdown requirements](../examples/trail-desk/current/product-requirements.md)
in a pull request. Review any corresponding catalog or acceptance check changes. **Factory bootstrap** builds the base and proposed
requirements and uploads their generated CALM, LikeC4, and HTML diffs in
`trail-desk-pr-preview`. After review, dispatch **Forge Factory E2E** from `main`
to qualify the build. Enable publication only for an approved release.
The distance-sorting acceptance checks also cover its interaction with the
step-free filter.

## Rehearse readiness and catalog delivery

In **Factory rehearsals**, leave `website_release` blank to run the built-in
`STORY-001` readiness fixture. Choose a direct or delegated topology and
optionally inject a fault or consult Jev. A custom readiness story needs a
tracked directory with `product-requirements.md`, `acceptance.json`,
`architecture.json` and `architecture.c4`. Confirm `public_inputs` only for files safe to send to
Copilot and retain in Actions artifacts. Custom inputs cannot publish to Pages.
Select `catalog_fixture` to exercise the catalog lifecycle workflow.

## Compare Trail Desk fixtures

In **Factory rehearsals**, set `website_release` to `baseline` to check the
three-trail catalog, or `step-free` to exercise the accessibility filter.
Compare their `factory-verified` artifacts for CALM, LikeC4 and Chromium
evidence. Keep `publish_pages=false` for verification. To compare live
releases, use a separate Pages test repository and explicitly enable
`publish_pages`. The live probe checks the served files and release manifest.

## Component rehearsals

The Pages bootstrap drill requires a separate test repository. Enable GitHub
Pages there with **GitHub Actions** as its source and restrict the
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
The live story and catalog fixture require the repository's
`COPILOT_GITHUB_TOKEN`.

`FORGE_REHEARSAL_REF` is an optional repository variable for a reviewed
branch rehearsal. Pages still requires the matching deployment environment
branch rule. Remove the exception after the rehearsal; ordinary releases
use the default branch.

Pages tests the static release and the public HTTP serving path. The
delegated Node worker and runtime repair tests run on Actions runners.
