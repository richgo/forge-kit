# Incident recovery authorization

`factory/recovery.mjs` makes a deterministic, bounded decision about whether an unresolved runtime incident is eligible for an **authenticated restoration request**. It does not deploy or roll back. Run `node --test test/recovery.test.mjs test/runtime.test.mjs test/monitor-cli.test.mjs`.

Inputs are (1) an escalation with ordered observations bound to the failing candidate release, (2) the failing candidate's immutable release and source identities, (3) the last known-good baseline's release digest, HTML digest and source commit, together with independently established `authenticated` and `observedHealthy` flags, and (4) a restoration budget and attempts already used.

The policy rejects inconsistent observations, resolved incidents, malformed digests, invalid budgets and arbitrary incident reasons. It escalates when the baseline is the same failing release, the budget is exhausted, or baseline trust/health is not established. Only a different, authenticated, previously healthy release can be requested, and only within the configured budget.

**Trust boundary:** the two baseline flags are assertions from a trusted caller, not proof by themselves. An external orchestrator must verify the prior archive's GitHub attestation, signer identity, exact source, retained observation and current environment state using the existing Pages release worker before using the returned request. The read-only monitor cannot authorize itself to deploy. No automatic restoration is claimed by these tests; production acceptance requires wiring this decision to the privileged recovery workflow and conducting a controlled live rehearsal.
