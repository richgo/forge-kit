# CLI-native consumer acceptance qualification

`bash scripts/qualify-native-consumers.sh` is a deterministic, non-agent
qualification. It creates three disposable Git baselines, generates a genuine
source patch that implements the approved discount request in each language,
then calls the **same project-owned independent verifier** used by APMX.

For each language it asserts:

1. The accepted source patch passes the real independent acceptance suite.
2. A patch modifying the request, requirements or acceptance tests is rejected.
3. An unknown check ID or an empty patch is rejected.

The [CI workflow](../../.github/workflows/native-consumers.yml) pins Python,
Go, Node.js and TypeScript. Its results demonstrate deterministic patch and
checker interoperability across the three toolchains. Use the [hosted language checklist](apmx-language-qualification.md)
to qualify agent execution, independent replay and the signed receipt.
