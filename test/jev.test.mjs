import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestJevRepair, routeRepair } from '../factory/integrations.mjs';

const retrySignal = { choice: 'retry-build', probability: 0.91 };
const state = { failure: 'readiness-mismatch', used: 0, limit: 1 };
const budget = {
  used: 0, limit: 1, elapsedMs: 900, timeLimitMs: 1000,
  spentUnits: 2, spendLimitUnits: 3, retryCostUnits: 1,
};

function providerResult(repair = { type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': 0.91, escalate: 0.09 } }) {
  return { model: 'jev-1.13.0', answers: { repair }, usage: { input_tokens: 100, output_tokens: 5 } };
}

test('sends a bounded choice request and reads the selected label probability', async () => {
  const signal = await requestJevRepair('test-token', async (url, request) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'jev-1.13.0');
    assert.deepEqual(Object.keys(body.questions.repair.criteria), ['retry-build', 'escalate']);
    assert.equal(body.questions.repair.type, 'choice');
    assert.equal(body.state, 'The fixture readiness check rejected the candidate build.');
    return {
      ok: true,
      json: async () => ({
        answers: {
          repair: { type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': 0.91, escalate: 0.09 } }
        }
      })
    };
  });
  assert.equal(routeRepair(signal, { used: 0, limit: 1 }), 'retry-build');
});

test('Jev transport failures and invalid choice responses fail closed', async () => {
  const unavailable = await requestJevRepair('test-token', async () => { throw new Error('unavailable'); });
  const malformed = await requestJevRepair('test-token', async () => ({
    ok: true,
    json: async () => ({ answers: { repair: { type: 'score', choice: 'retry-build' } } })
  }));
  const contradictory = await requestJevRepair('test-token', async () => ({
    ok: true,
    json: async () => ({
      answers: {
        repair: { type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': 0.9, escalate: 0.95 } }
      }
    })
  }));
  assert.equal(routeRepair(unavailable, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair(malformed, { used: 0, limit: 1 }), 'escalate');
  assert.equal(routeRepair(contradictory, { used: 0, limit: 1 }), 'escalate');
});

test('sends only the approved typed repair state to the fixed endpoint', async () => {
  let outbound;
  const signal = await requestJevRepair('test-token', async (url, request) => {
    outbound = { url, body: JSON.parse(request.body) };
    return Response.json(providerResult());
  }, { state });
  assert.equal(outbound.url, 'https://api.typesafe.ai/v1/systemone');
  assert.deepEqual(outbound.body.state, { failure: 'readiness-mismatch', used: 0, limit: 1 });
  assert.deepEqual(signal, retrySignal);
});

test('rejects unapproved repair state and missing credentials before sending', async () => {
  let sent = 0;
  const send = async () => { sent++; return Response.json(providerResult()); };
  for (const badState of [
    'send raw logs', { ...state, logs: 'secret' }, { ...state, failure: 'secret' },
    { ...state, used: -1 }, { ...state, used: 2 }, { ...state, limit: '1' },
    Object.create(state), { ...state, toJSON: () => 'secret' },
  ]) {
    assert.equal(await requestJevRepair('test-token', send, { state: badState }), null);
  }
  for (const badToken of ['', undefined, 'header\ninjection']) {
    assert.equal(await requestJevRepair(badToken, send, { state }), null);
  }
  assert.equal(sent, 0);
});

test('the Jev timeout covers a stalled response body', { timeout: 500 }, async () => {
  let signal;
  const result = await requestJevRepair('test-token', async (_url, request) => {
    signal = request.signal;
    return { ok: true, json: () => new Promise(() => {}) };
  }, { state, timeoutMs: 15 });
  assert.equal(result, null);
  assert.equal(signal.aborted, true);
});

test('rejects oversized, wrong-model, and ambiguous provider responses', async () => {
  const badResponses = [
    Response.json({ ...providerResult(), padding: 'x'.repeat(32_768) }),
    Response.json({ ...providerResult(), model: 'unexpected-model' }),
    Response.json({ ...providerResult(), answers: { ...providerResult().answers, extra: {} } }),
    Response.json(providerResult({ type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': 0.5, escalate: 0.5 } })),
    Response.json(providerResult({ type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': 0.2, escalate: 0.8 } })),
    Response.json(providerResult({ type: 'choice', choice: 'retry-build', probabilities: { 'retry-build': '0.91', escalate: 0.09 } })),
    Response.json(providerResult({ type: 'choice', choice: 'deploy', probabilities: { 'retry-build': 0.91, escalate: 0.09 } })),
    Response.json(providerResult(), { status: 429 }),
    Response.json(providerResult(), { status: 201 }),
    new Response('{ malformed', { headers: { 'Content-Type': 'application/json' } }),
  ];
  for (const response of badResponses) {
    assert.equal(await requestJevRepair('test-token', async () => response, { state }), null);
  }
});

test('local policy requires available attempts, time, and spend before any retry', () => {
  assert.equal(routeRepair(retrySignal, budget), 'retry-build');
  assert.equal(routeRepair({ ...retrySignal, probability: 0.8 }, budget), 'retry-build');
  for (const deniedBudget of [
    { ...budget, used: 1 }, { ...budget, elapsedMs: 1000 }, { ...budget, spentUnits: 3 },
    { ...budget, retryCostUnits: 2 }, { ...budget, elapsedMs: -1 },
    { ...budget, spendLimitUnits: Infinity }, { ...budget, spentUnits: 2.5 },
    { ...budget, retryCostUnits: 0 }, { used: 0, limit: 1, elapsedMs: 0 }, undefined,
    { ...budget, unexpected: true }, Object.assign(Object.create({ used: 0, limit: 1 }),
      { elapsedMs: 0, timeLimitMs: 1000, spentUnits: 0, spendLimitUnits: 1, retryCostUnits: 1 }),
  ]) {
    assert.equal(routeRepair(retrySignal, deniedBudget), 'escalate');
  }
  for (const deniedSignal of [null, { choice: 'deploy', probability: 1 }, { ...retrySignal, probability: 0.799 }]) {
    assert.equal(routeRepair(deniedSignal, budget), 'escalate');
  }
});
