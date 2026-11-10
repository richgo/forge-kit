# Hosted end-to-end rehearsal

> **Implementation note (November 2026):** The recommended new-project path is the [CLI-native blueprint](../blueprint/README.md) using pinned APMX/APM capabilities. The `factory/*.mjs` commands described below document the **legacy reference implementation** and remain for regression/migration parity; they are not the portable blueprint. See [migration gates](../docs/cli-native-migration.md) and [current status](../docs/implementation-status.md). No live deployment or full multi-language agent qualification should be inferred from local reference tests.

## Run the factory in one GitHub Actions run

Open **Actions → Forge Factory E2E → Run workflow** on the default branch.
The GitHub Agentic Workflow uses its `call-workflow` safe output to start
one pinned worker. The workflow fails if the worker is skipped or fails.
The worker reads the original dispatch, executes the Forge Kit CLI, runs
the pinned APMX contract against that candidate, and replays both the
runtime and APMX checks in a fresh job before signing.

The release workflow accepts only `website_release=current`. It runs on
`main` and publishes to Pages by default. Turn off `publish_pages` to
verify the current product without publishing.

Download `factory-verified` for the independent Chromium observations,
requirements trace, and in-toto receipts. `factory-pages-observation`
records the HTTPS checks of the public site and architecture files.


## Release Trail Desk on Pages

Trail Desk is a fictional trail directory. Its reviewed product
requirements are under `examples/trail-desk`. The requirements do not include an
architecture or a website. The factory generates CALM, projects the LikeC4
view from the CALM graph, and builds the static site.

To replay the original example, open **Factory rehearsals** and select its
`website_release` fixtures in this order:

1. `baseline` publishes the three-trail catalog and checks AC-101.
2. `step-free` keeps that story and adds the filter story. CALM adds
   `step_free_filter` and its browser and catalog connections. Chromium
   checks that filtering hides Juniper Ridge and clearing restores it.

The worker validates the models with the FINOS CALM and LikeC4 CLIs. In a
separate job, it checks Chromium behavior and replays the native APMX
contract against the exact requirements, CALM, and HTML. Pages promotion
requires the checked APMX attestation. The deployed site links to the
generated CALM, LikeC4 and release manifest. The live HTTP probe hashes all
three site files. Each run keeps its own `factory-candidate` and
`factory-verified` artifacts so the revisions can be compared after the
second release replaces the first at the same URL.

For a product change, edit `examples/trail-desk/current/product-requirements.json`
in a pull request. **Factory bootstrap** builds the base and proposed
requirements and uploads their generated CALM, LikeC4, and HTML diffs in
`trail-desk-pr-preview`. After review, dispatch **Forge Factory E2E** from `main`
to run native APMX and promote the independently
checked build. The current story adds distance sorting and verifies that
it composes with the step-free filter.

In **Factory rehearsals**, leave `website_release` blank to run the built-in
`STORY-001` readiness fixture. Choose a direct or delegated topology, and
optionally inject a fault or consult Jev. A custom readiness story needs a
tracked directory with `product-requirements.json`, `architecture.json` and
`architecture.c4`. Confirm `public_inputs` only for files safe to send to
Copilot and retain in Actions artifacts. Custom inputs cannot publish to Pages.
Select `catalog_fixture` to exercise the separate legacy catalog workflow.

## Component rehearsals


Pages publication in **Factory rehearsals** and the bootstrap drill requires a separate test repository. Enable GitHub Pages there with **GitHub Actions** as its source and restrict the
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
The live story and legacy catalog fixture require the repository's
`COPILOT_GITHUB_TOKEN`.

`FORGE_REHEARSAL_REF` is an optional repository variable for a reviewed
branch rehearsal. Pages still requires the matching deployment environment
branch rule. Remove the exception after the rehearsal; ordinary releases
use the default branch.

Pages tests the static release and the public HTTP serving path. The
delegated Node worker and runtime repair tests run on Actions runners.
