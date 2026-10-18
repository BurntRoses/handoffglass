import test from 'node:test';
import assert from 'node:assert/strict';
import { safeBrokerRetry } from '../src/runtime.mjs';
test('never replay an ambiguous POST without an explicit idempotency key', () => {
  assert.equal(safeBrokerRetry('/agent/show', 'POST', { title:'Sensitive' }), false);
  assert.equal(safeBrokerRetry('/agent/show', 'POST', { title:'Sensitive', requestId:'abc-long-request-id' }), true);
  assert.equal(safeBrokerRetry('/agent/displays', 'GET'), true);
  assert.equal(safeBrokerRetry('/agent/cancel', 'POST', { sessionId:'known-session' }), true);
  assert.equal(safeBrokerRetry('/decision', 'POST', {}), false);
});
