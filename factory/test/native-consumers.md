# CLI-native consumer acceptance qualification

`bash scripts/qualify-native-consumers.sh` is a deterministic, non-agent
qualification. It creates three disposable Git baselines, generates a genuine
source patch that implements the approved discount request in each language,
then calls the **same project-owned independent verifier** used by APMX.

For each language it asserts:

1. The accepted source patch passes the real independent acceptance suite.
2. A patch modifying a protected reviewed file is rejected.
3. An empty patch is rejected.

GitHub Actions pins Python, Go, Node and TypeScript toolchains for the
qualification job. This suite does not replace a real hosted APMX agent run
and does not qualify attestations, release or rollback. It demonstrates
language-neutral patch/checker interoperability without `factory/*.mjs`.
