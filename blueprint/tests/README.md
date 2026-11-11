# Blueprint conformance

Use an approved base and trusted [.forge/verify-change](../.forge/verify-change).
Exercise it with these inputs before sending a request to an agent.

| Candidate | Expected result |
| --- | --- |
| Unapplied patch that implements the approved behavior | Protected build, architecture and acceptance checks pass. |
| Patch within scope that implements the wrong behavior | Acceptance fails and the verifier returns nonzero. |
| Patch that changes the checker, tests or another protected path | Scope check rejects the patch before candidate execution. |
| Missing, empty or malformed patch | The verifier returns nonzero. |

The [deterministic consumer suite](../../factory/test/native-consumers.md)
exercises valid, protected-path and empty patches in three languages.
The [static gate](../../scripts/check-blueprint-cli-native.sh) checks the
portable template and its execution boundary. The shipped verifier fails
closed until the project supplies working checks.

For hosted qualification, inspect the APMX plan, run the agent on an approved
request, verify independent replay, and authenticate the receipt against the
reviewed run. [Hosted language qualification](../../factory/test/apmx-language-qualification.md)
