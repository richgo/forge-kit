import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const maxTimeoutMs = 5000;
const repairChoices = ['retry-build', 'escalate'];
const runtimeChoices = ['restore', 'retry-observation', 'escalate'];
const repairFailures = ['readiness-mismatch', 'unclassified-failure', 'ambiguous-failure'];
const runtimeFailures = ['confirmed-content-mismatch', 'unconfirmed'];

function repairInput({ failure, used, limit } = {}) {
  if (repairFailures.includes(failure) && Number.isSafeInteger(used) && Number.isSafeInteger(limit) &&
      used >= 0 && used <= limit) return { failure, used, limit };
  return null;
}

export function loadDecisionAdvisor(env = process.env) {
  const modulePath = env.FORGE_DECISION_PROVIDER_MODULE;
  if (!modulePath && !env.FORGE_JEV_TOKEN) return undefined;

  let provider;
  const load = async () => {
    if (modulePath) return import(pathToFileURL(resolve(modulePath)));
    const { createJevAdvisor } = await import('./jev-advisor.mjs');
    return createJevAdvisor(env);
  };

  const request = async (method, choices, state, { timeoutMs = maxTimeoutMs } = {}) => {
    if (!state || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > maxTimeoutMs) return null;
    const controller = new AbortController();
    let timer;
    const deadline = new Promise(resolve => {
      timer = setTimeout(() => {
        resolve(null);
        controller.abort();
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([
        (provider ??= load()).then(adapter => controller.signal.aborted
          ? null
          : adapter[method](state, { timeoutMs, signal: controller.signal })),
        deadline,
      ]);
      const { choice, probability } = result ?? {};
      return choices.includes(choice) && Number.isFinite(probability) && probability >= 0 && probability <= 1
        ? { choice, probability }
        : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };

  return {
    recommendRepair: (state, options) => request('recommendRepair', repairChoices, repairInput(state ?? undefined), options),
    recommendRuntime: (state, options) => {
      const failure = state?.failure;
      return request('recommendRuntime', runtimeChoices, runtimeFailures.includes(failure) ? { failure } : null, options);
    },
  };
}
