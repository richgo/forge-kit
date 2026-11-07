const roles = ['orchestration', 'execution', 'checking', 'skills', 'mcp'];

function packageReference({ repository, path, ref }) {
  if (typeof repository !== 'string' || repository.trim() !== repository ||
      !/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i.test(repository) || /\/\.{1,2}$/.test(repository) ||
      (path !== undefined && (typeof path !== 'string' || !path.split('/').every(
        part => part.trim() === part && /^[a-z0-9_.-]+$/i.test(part) && part !== '.' && part !== '..'
      )))) {
    throw new Error('Expected an external GitHub APM package');
  }
  if (repository.toLowerCase() === 'richgo/forge-kit') {
    throw new Error('Factory primitives must be external');
  }
  if (typeof ref !== 'string' || ref.length !== 40 || !/^[a-f0-9]{40}$/.test(ref)) {
    throw new Error('Expected a full commit SHA');
  }
  return repository + (path ? '/' + path : '') + '#' + ref;
}

export async function requestJevRepair(token, send = fetch) {
  try {
    const response = await send('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        state: 'The fixture readiness check rejected the candidate build.',
        questions: {
          repair: {
            type: 'choice',
            instructions: 'Recommend one bounded retry for this known fixture failure, or escalate.',
            criteria: { 'retry-build': 'Retry the fixture build', escalate: 'Request human review' },
          },
        },
      }),
    });
    if (!response.ok) return null;
    const answer = (await response.json())?.answers?.repair;
    if (answer?.type !== 'choice' || !['retry-build', 'escalate'].includes(answer.choice)) return null;
    const probabilities = answer.probabilities ?? {};
    const retry = probabilities['retry-build'];
    const escalate = probabilities.escalate;
    if (Object.keys(probabilities).length !== 2 ||
        ![retry, escalate].every(value => Number.isFinite(value) && value >= 0 && value <= 1) ||
        Math.abs(retry + escalate - 1) > 0.001) {
      return null;
    }
    const selected = probabilities[answer.choice];
    if (selected < Math.max(retry, escalate)) return null;
    return { choice: answer.choice, probability: selected };
  } catch {
    return null;
  }
}

export function assemble(manifest) {
  if (manifest.version !== 1 || !manifest.capabilities ||
      Object.keys(manifest.capabilities).length !== roles.length ||
      !roles.every(role => Object.hasOwn(manifest.capabilities, role))) {
    throw new Error('Invalid capability manifest');
  }
  const pending = roles.filter(role => manifest.capabilities[role] === null);
  const packages = Object.fromEntries(roles.filter(role => !pending.includes(role))
    .map(role => [role, packageReference(manifest.capabilities[role])]));
  return { pending, packages, rehearsal: packageReference(manifest.rehearsal) };
}

// The adapter normalizes a provider's choice and selected label probability.
// Local policy owns the threshold, legal route, and attempt limit.
export function routeRepair(signal, { used, limit }) {
  if (signal?.choice === 'retry-build' && Number.isFinite(signal.probability) &&
      signal.probability >= 0.8 && signal.probability <= 1 &&
      Number.isSafeInteger(used) && used >= 0 && Number.isSafeInteger(limit) && used < limit) {
    return 'retry-build';
  }
  return 'escalate';
}
