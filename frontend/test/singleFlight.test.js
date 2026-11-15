import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleFlight } from '../src/utils/singleFlight.js';

test('overlapping session refresh calls share one operation', async () => {
  let calls = 0;
  let complete;
  const refresh = createSingleFlight(() => {
    calls += 1;
    return new Promise((resolve) => { complete = resolve; });
  });

  const first = refresh();
  const second = refresh();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  complete({ token: 'test-access-token' });
  assert.deepEqual(await first, { token: 'test-access-token' });

  const third = refresh();
  await Promise.resolve();
  complete({ token: 'next-access-token' });
  await third;
  assert.equal(calls, 2);
});

test('failed single-flight operation can be retried', async () => {
  let calls = 0;
  const operation = createSingleFlight(() => {
    calls += 1;
    return calls === 1 ? Promise.reject(new Error('expired')) : Promise.resolve('ok');
  });
  await assert.rejects(operation(), /expired/);
  assert.equal(await operation(), 'ok');
  assert.equal(calls, 2);
});
