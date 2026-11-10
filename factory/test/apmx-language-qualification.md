# Hosted language qualification

Use **Actions → Qualify APMX language consumers → Run workflow** on the
protected default branch. Choose one consumer per run. The workflow calls
the pinned APMX reusable factory, which creates the patch, independently
replays its contract checks, and attests the checked delivery artifact.
The candidate patch is **not merged, deployed, or trusted merely because
the model produced it**.

Prerequisites:

1. Configure the `COPILOT_GITHUB_TOKEN` secret with access to the agent
   harness. Confirm its permissions and billing before dispatch.
2. Ensure the selected upstream APMX runner can provision the chosen
   language toolchain. In particular the TypeScript fixture needs `tsc`;
   Go needs a supported Go compiler; Python needs Python 3.
3. Confirm the fixture's approved base, checker, acceptance tests and
   package pin have been reviewed. Do not permit a candidate to edit
   protected checks or the workflow.

For each consumer, collect the APMX receipt and delivery artifacts, verify
their attestations against the approved run identity and source, inspect the
actual patch, and check that the independent acceptance suite passed.
Record run IDs and attestation identities in the qualification report.
Three completed, successful hosted runs are necessary before claiming
multi-language agent delivery has been qualified.

The fixtures intentionally start with failing feature tests. A green hosted
run must demonstrate a real agent-authored source change, not a pre-canned
fixture. These workflows do not qualify production release, observation or
rollback. If the runner lacks the required toolchain, record the failure and
fix the pinned runner configuration rather than weakening the checks.
