# Trail Desk website security gate

The `security-review` APM package exports a Chromium checker for the static
Trail Desk release. It inspects the candidate HTML before executing it and
checks the same bytes in an isolated browser context. The report identifies
the policy, the SHA-256 of `index.html`, the number of reviewed scripts, and
the checks that ran.

- The page declares one early Content Security Policy. It denies resources
  by default, disables connections and form submissions, and permits only
  hash-authorized inline code and CSS. The checker owns the reviewed hashes
  for the filter and distance sorter.
- The checker allows the three relative links to the release evidence and
  architecture files. It rejects unexpected markup and attributes, including
  scripts with a source, inline handlers, embedded content, and off-site links.
- Chromium exercises the filter and all sort choices together and separately
  as the candidate supports them. The checker fails on attempted requests,
  CSP violations, script errors, or unexpected navigation. It also checks
  parsed CSS for resource URLs.
- On the checked page, Chromium must block three deliberate probes. They
  attempt to execute a new inline script, apply a new inline stylesheet,
  and fetch a same-origin path. The verifier intercepts requests locally.

## Reproduce

In the external catalog checkout, set `FORGE_PLAYWRIGHT` to the absolute
path to the Playwright `index.mjs` module with Chromium installed. Run
`node --test test/website-security.test.mjs` and confirm that none of the
tests were skipped. Negative cases cover weak and misplaced CSP, candidate
code that authorizes itself, inline handlers, external links and resources,
and CSS that tries to load a resource after the filter and sort change.

Run **Forge Factory E2E** with a Trail Desk release and
`publish_pages=false` to exercise the hosted security gate without a Pages
deployment. Inspect the independently verified security report and compare
its `siteSha256` to the `index.html` digest in the release manifest.

Changes to either browser script require review of the new program and
an update to its hash in the external security package. The policy covers
the Trail Desk HTML and its Chromium behavior. The separate hosted release
checks establish archive provenance and compare served bytes with the
checked release.
