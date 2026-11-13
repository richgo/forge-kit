import { readFileSync } from 'node:fs';

const { total, currency } = JSON.parse(readFileSync(0, 'utf8'));
if (!Number.isSafeInteger(total) || !/^[A-Z]{3}$/.test(currency)) {
  throw new Error('Incompatible checkout API response');
}
console.log(new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(total / 100));
