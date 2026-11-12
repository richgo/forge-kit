import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = 'checks/jev.mjs';

export function loadRepairPolicy(location = process.env.FORGE_DECISION_PACKAGE) {
  return import(location ? pathToFileURL(resolve(location, entry)) :
    new URL('../apm_modules/richgo/forge-kit-skills/packages/repair-acceptance/' + entry, import.meta.url));
}

export function createJevAdvisor(env) {
  const token = env.FORGE_JEV_TOKEN;
  const runtimeModule = env.FORGE_RUNTIME_ADVISOR;
  return {
    async recommendRepair(state, { timeoutMs }) {
      const { requestJevRepair } = await loadRepairPolicy(env.FORGE_DECISION_PACKAGE);
      return requestJevRepair(token, fetch, { state, timeoutMs });
    },
    async recommendRuntime(state, { timeoutMs }) {
      const { requestJevRuntime } = runtimeModule
        ? await import(pathToFileURL(runtimeModule))
        : await loadRepairPolicy(env.FORGE_DECISION_PACKAGE);
      return requestJevRuntime(token, fetch, state, timeoutMs);
    },
  };
}
