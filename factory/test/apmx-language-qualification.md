# Hosted language qualification

Use **Actions → Qualify APMX language consumers → Run workflow** on the
protected default branch. Choose one consumer per run. The workflow calls
the pinned APMX reusable factory, which creates the patch, independently
replays its contract checks, and attests the delivery and binds it to the checked receipt.
The workflow returns the checked patch and receipt for project review.

Prerequisites:

1. Configure the `COPILOT_GITHUB_TOKEN` secret with access to the agent
   harness. Confirm its permissions and billing before dispatch.
2. Confirm the pinned Ubuntu runner has Python 3, Go or `tsc` and Node.js
   for the selected consumer. Supply missing tools through a reviewed
   checker or workflow adaptation.
3. Confirm the fixture's approved base, checker, acceptance tests and
   package pin have been reviewed. Do not permit a candidate to edit
   protected checks or the workflow.

For each consumer, download `apmx-receipt` and `apmx-delivery`. Verify
the signed delivery and its receipt against the approved workflow identity
and source revision. Use the [APMX evidence instructions](../../docs/apmx-factory.md#review-the-evidence)
to locate the patch and verify the delivery files. Inspect the source changes
and confirm that independent acceptance passed.
Record the run ID, project and toolchain, receipt identity, patch digest,
and replay outcome in the qualification report.
Three completed, successful hosted runs are necessary before claiming
multi-language agent delivery has been qualified.

The fixtures intentionally start with failing feature tests. A green hosted
run must demonstrate a real agent-authored change against the approved base.
For publication and recovery evidence, use the product's protected release
workflow. If a required tool is missing, record the failed run and configure
the runner to supply that tool.
