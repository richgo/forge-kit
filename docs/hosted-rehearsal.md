# Hosted end-to-end rehearsal

## Run the factory in one GitHub Actions run

Open **Actions → Forge Factory E2E → Run workflow** on the default branch.
The GitHub Agentic Workflow uses its `call-workflow` safe output to start
one pinned worker. The workflow fails if the worker is skipped or fails.
The worker reads the original dispatch, executes the Forge Kit CLI, runs
the pinned APMX contract against that candidate, and replays both the
runtime and APMX checks in a fresh job before signing.

- Leave `input_directory` blank to run the built-in `STORY-001` example.
  Use `topology` to choose a direct probe or a delegated worker.
- For a reviewed story, supply a tracked directory containing
  `product-requirements.json`, `architecture.json` and `architecture.c4`,
  plus its `story` ID. Confirm `public_inputs` only for files safe to send
  to Copilot and retain in GitHub Actions artifacts. This reference supports
  the readiness-probe contract.
- `inject_fault` injects a failed first build. `use_jev` enables a live
  advisory repair decision, which may escalate and stop the run.
- `publish_pages` deploys and probes the checked public reference only.
  Custom inputs are excluded from Pages. The separate Pages drill below
  rehearses swapping releases and restoring the prior baseline.

Download `factory-verified` for the independently replayed requirements
trace and in-toto receipts, or `factory-pages-observation` for the
public HTTP proof when Pages is enabled. `catalog_fixture` selects the
older catalog rehearsal.

## Component rehearsals


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
