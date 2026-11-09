import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const { requestJevRuntime } = await import(pathToFileURL(process.env.FORGE_RUNTIME_ADVISOR));
const results = [];
for (const failure of ['confirmed-content-mismatch', 'unconfirmed']) {
  let status;
  const recommendation = await requestJevRuntime(process.env.FORGE_JEV_TOKEN, async (...args) => {
    const response = await fetch(...args);
    status = response.status;
    return response;
  }, { failure });
  results.push({ failure, status: status ?? null, recommendation });
}
console.log(JSON.stringify(results, null, 2));
assert.ok(results.every(({ recommendation }) => recommendation), 'Jev must return typed runtime advice');
