import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestJevRepair, routeRepair } from '../factory/integrations.mjs';

test('sends a bounded choice request and reads the selected label probability', async () => {
  const signal = await requestJevRepair('test-token', async (url, request) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone');
    assert.equal(request.redirect, 'error');
    assert.equal(request.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(request.body);
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
