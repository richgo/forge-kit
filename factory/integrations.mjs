const roles = [
  'orchestration', 'execution', 'checking', 'skills', 'mcp',
  'architecture', 'websiteChecking', 'repairChecking', 'delivery', 'buildRepair', 'securityReview',
];

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

const jevModel = 'jev-1.13.0';
const jevTimeoutMs = 5000;
const jevResponseBytes = 16_384;
const failures = ['readiness-mismatch', 'unclassified-failure', 'ambiguous-failure'];
const choices = ['retry-build', 'escalate'];
const attemptKeys = ['used', 'limit'];
const budgetKeys = [...attemptKeys, 'elapsedMs', 'timeLimitMs', 'spentUnits', 'spendLimitUnits', 'retryCostUnits'];

function isCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function hasKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Reflect.ownKeys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

async function readJevResponse(response) {
  // Preserve the response.json() transport seam for existing injected callers.
  if (!response.body?.getReader) return response.json();
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('Content-Type') ?? '')) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let json = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return JSON.parse(json + decoder.decode());
      size += value.byteLength;
      if (size > jevResponseBytes) {
        void reader.cancel().catch(() => {});
        return null;
      }
      json += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function requestJevRepair(token, send = fetch, options = {}) {
  const { state, timeoutMs = jevTimeoutMs } = options ?? {};
  if (typeof token !== 'string' || !/^[\x21-\x7e]+$/.test(token) ||
      !isCount(timeoutMs) || timeoutMs === 0 || timeoutMs > jevTimeoutMs) return null;

  let approvedState = 'The fixture readiness check rejected the candidate build.';
  if (state !== undefined) {
    if (!hasKeys(state, ['failure', 'used', 'limit'])) return null;
    const { failure, used, limit } = state;
    if (!failures.includes(failure) || !isCount(used) || !isCount(limit) || used > limit) return null;
    approvedState = { failure, used, limit };
  }

  const controller = new AbortController();
  let timer;
  const deadline = new Promise(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const evaluate = async () => {
    const response = await send('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      redirect: 'error',
      signal: controller.signal,
      body: JSON.stringify({
        model: jevModel,
        state: approvedState,
        questions: {
          repair: {
            type: 'choice',
            instructions: state === undefined ? 'Recommend one bounded retry for this known fixture failure, or escalate.' :
              'Recommend one bounded rebuild from the same approved inputs or escalate for human review.',
            criteria: state === undefined ? { 'retry-build': 'Retry the fixture build', escalate: 'Request human review' } : {
              'retry-build': 'A confirmed readiness-mismatch with used below limit is eligible for one retry.',
              escalate: 'The failure is unclassified or ambiguous, or used has reached limit.',
            },
          },
        },
      }),
    });
    if (response.ok !== true || (response.status !== undefined && response.status !== 200)) return null;
    const result = await readJevResponse(response);
    if (!hasKeys(result?.answers, ['repair']) ||
        ((state !== undefined || result.model !== undefined) && result.model !== jevModel)) return null;
    const answer = result.answers.repair;
    if (answer?.type !== 'choice' || !choices.includes(answer.choice)) return null;
    const probabilities = answer.probabilities;
    if (!hasKeys(probabilities, choices)) return null;
    const retry = probabilities['retry-build'];
    const escalate = probabilities.escalate;
    if (![retry, escalate].every(value => Number.isFinite(value) && value >= 0 && value <= 1) ||
        Math.abs(retry + escalate - 1) > 0.001) {
      return null;
    }
    const selected = probabilities[answer.choice];
    const other = answer.choice === 'retry-build' ? escalate : retry;
    if (selected <= other) return null;
    return { choice: answer.choice, probability: selected };
  };
  try {
    return await Promise.race([evaluate(), deadline]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
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
  const orchestration = manifest.capabilities.orchestration;
  let orchestrator = null;
  if (orchestration) {
    const { repository, workflow, ref } = orchestration;
    if (typeof workflow !== 'string' || workflow.trim() !== workflow ||
        !/^\.github\/workflows\/[a-z0-9_-]+\.lock\.yml$/.test(workflow)) {
      throw new Error('Expected a compiled reusable GH-AW workflow');
    }
    orchestrator = repository + '/' + workflow + '@' + ref;
  }
  return { pending, packages, orchestrator, rehearsal: packageReference(manifest.rehearsal) };
}

export function apmManifest(packages) {
  const references = [...new Set(Object.values(packages))].sort();
  const dependencies = references.length ? ['  apm:', ...references.map(ref => "    - '" + ref + "'")] : ['  apm: []'];
  return ['name: forge-kit', 'version: "0.1.0"', 'targets: [copilot]', 'dependencies:',
    ...dependencies, '  mcp: []', ''].join('\n');
}

// Attempt-only callers keep their original contract. Budgeted callers must
// supply all time and spend fields together, using their local clock and meter.
export function repairBudgetAllowsRetry(budget) {
  const attemptOnly = hasKeys(budget, attemptKeys);
  const keys = attemptOnly ? attemptKeys : budgetKeys;
  if (!hasKeys(budget, keys) || !keys.every(key => isCount(budget[key])) || budget.used >= budget.limit) return false;
  if (attemptOnly) return true;
  const { elapsedMs, timeLimitMs, spentUnits, spendLimitUnits, retryCostUnits } = budget;
  return elapsedMs < timeLimitMs && retryCostUnits > 0 && retryCostUnits <= spendLimitUnits - spentUnits;
}

export function routeRepair(signal, budget) {
  if (signal?.choice === 'retry-build' && Number.isFinite(signal.probability) &&
      signal.probability >= 0.8 && signal.probability <= 1 &&
      repairBudgetAllowsRetry(budget)) {
    return 'retry-build';
  }
  return 'escalate';
}
