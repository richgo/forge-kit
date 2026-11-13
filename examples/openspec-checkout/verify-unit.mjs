import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [phase, unit, check] = process.argv.slice(2);
assert.ok(['baseline', 'candidate'].includes(phase));
assert.equal(check, 'checkout.currency');

// Each unit asserts its own contract with reviewed boundary data.
const response = { total: 2500, currency: 'GBP' };
let observed;
switch (unit) {
  case 'contract': {
    const contract = JSON.parse(readFileSync('schema.json', 'utf8'));
    assert.ok(Array.isArray(contract.required) && contract.required.includes('total'));
    observed = contract.required.includes('currency') && contract.currency === response.currency;
    break;
  }
  case 'api': {
    const api = execFileSync('python3', ['checkout.py', '.forge/expected-contract.json'], { encoding: 'utf8' });
    const result = JSON.parse(api);
    assert.equal(result.total, response.total);
    observed = result.currency === response.currency;
    break;
  }
  case 'web': {
    const display = execFileSync(process.execPath, ['checkout.mjs'], {
      input: JSON.stringify(response), encoding: 'utf8',
    }).trim();
    assert.ok(display);
    observed = display === '£25.00';
    break;
  }
  default:
    throw new Error('Unexpected implementation unit ' + unit);
}

if (!observed) process.exitCode = phase === 'baseline' ? 10 : 1;
