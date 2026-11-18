import test from 'node:test';
import assert from 'node:assert/strict';

const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/services/socket.js', import.meta.url), 'utf8'));

test('shared socket explicitly refreshes and reconnects after server token-expiry signal', () => {
  assert.match(source, /socket\.on\('session:expired'/);
  assert.match(source, /refreshAuthSession/);
  assert.match(source, /activeSocket\.auth = \{ token \}/);
  assert.match(source, /!activeSocket\.connected/);
});

test('normal disconnects do not install a generic reconnect bypass', () => {
  assert.doesNotMatch(source, /socket\.on\('disconnect'.*refreshAndReconnectSocket/s);
});
