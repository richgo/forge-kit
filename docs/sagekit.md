# Run ForgeKit with SageKit

The **APMX software factory with SageKit** workflow runs ForgeKit's native
APMX factory and independent replay with two optional SageKit gates.
The requirements gate runs before the factory. The release gate runs after
APMX has independently replayed the checks and published the digest of the
receipt of record. Both gates use the same pinned corpus revision, embedding
profile, and hashes of the approved input files. The checks run in separate
jobs from the candidate, so the agent receives no SageKit credentials.

Create a reviewed `.forge/sagekit.json` in the consumer workspace on
`main`. Gates default to `off` when omitted. Configure `advisory` to retain
the report while the factory continues, or `required` to require enough
authorized evidence. The existing APMX checks continue to determine whether
the change passes independently.

```json
{
  "inputs": ["architecture.json"],
  "gates": {
    "requirements": {"mode": "advisory", "query": "checkout requirements"},
    "release": {"mode": "required", "query": "checkout release decisions", "minimum_evidence": 1}
  },
  "change": {
    "kind": "architecture",
    "title": "Checkout retry safety",
    "summary": "The approved change passed the project's independent acceptance checks."
  }
}
```

`request.md` and `specs/product-requirements.md` are always pinned when SageKit is
used. Use `inputs` for additional approved paths, such as a CALM architecture
file. A gate can use SageKit's `exact_ids` and typed `decision` fields.
Set the repository variable `SAGEKIT_REMOTE_URL` to the HTTPS service origin
and the secret `SAGEKIT_READ_TOKEN` to a read-only token. Give the token the
`decide` scope only if a gate asks for a typed decision. Scope credentials to
evidence suitable for the repository's Actions artifacts.

Dispatch the workflow from `main` with the reviewed workspace path. The
existing Copilot token is used by the native APMX run. Download
`sagekit-state`, `sagekit-release-gate`, and `apmx-receipt` to inspect the
pins, gate results, and independent verification evidence.

## Enable post-success promotion

Select `promote` in the dispatch form for a reviewed product or architecture
change. The workflow checks the exact receipt bytes against the independent
APMX job output. It then attests the promotion request and calls SageKit's
protected publishing workflow. The candidate and its verifier jobs never
receive the publishing token or receipt signing key.

Configure the `sagekit-promotion` GitHub environment with approval and
main-branch restrictions. Set `SAGEKIT_VERIFIER_WORKFLOW` to
`richgo/forge-kit/.github/workflows/apmx-sagekit.yml` and
`SAGEKIT_VERIFIER_DIGEST` to the reviewed ForgeKit workflow commit.
Configure the authorized origin, SageKit revision, and environment secrets
as described in the [SageKit publisher guide](https://github.com/richgo/sage-kit/blob/43640fbdf498ab1043237296ad1bf39de5f750c7/docs/forgekit.md).

The [ForgeKit integration CI](../.github/workflows/sagekit-ci.yml) runs
without production credentials. It exercises actual SageKit persistence and
promotion after the ForgeKit verifier succeeds, and checks that a changed
input or receipt blocks promotion.
