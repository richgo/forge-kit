# Product requirements

## Epic EPIC-001 — Safe release promotion

Outcome: A release operator can tell when a candidate is ready.

### Feature FEAT-001 — Probe readiness

Outcome: The deployed candidate exposes a reproducible readiness result.

#### Story STORY-001 — Report verified readiness

Architecture owner: `health_probe`

As a release operator, I want to run the deployed probe so that I can confirm it is ready.

##### Acceptance AC-001 — Print the readiness result

- Given the candidate is deployed.
- When the operator runs the deployed probe.
- Then the probe prints `ready`.
- Check: `ac-001`

##### Acceptance AC-002 — Exit successfully

- Given the candidate is deployed.
- When the operator runs the deployed probe.
- Then the probe exits with code 0.
- Check: `ac-002`
