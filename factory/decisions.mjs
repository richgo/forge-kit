import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const entry = 'checks/jev.mjs';
const location = process.env.FORGE_DECISION_PACKAGE;
const policy = await import(location ? pathToFileURL(resolve(location, entry)) :
  new URL('../apm_modules/richgo/forge-kit-skills/packages/repair-acceptance/' + entry, import.meta.url));

export const { repairBudgetAllowsRetry, requestJevRepair, routeRepair } = policy;
