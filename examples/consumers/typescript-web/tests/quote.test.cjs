const { test } = require('node:test');
const assert = require('node:assert/strict');
const { total } = require('../dist/quote.js');

test('zero discount remains unchanged', () => assert.equal(total(500), 500));
test('discount is applied', () => assert.equal(total(500, 125), 375));
test('discount cannot make total negative', () => assert.equal(total(100, 200), 0));
test('invalid inputs are rejected', () => {
  for (const value of [-1, 1.5, NaN, true]) assert.throws(() => total(value));
});
