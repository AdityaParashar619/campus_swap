import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-error-middleware-test-secret';
process.env.NODE_ENV = 'test';

const { errorHandler } = await import('../middleware/errorMiddleware.js');

test('non-Error rejection logs a stable diagnostic and sends one sanitized response', () => {
  const original = console.error;
  let logArgs;
  let sends = 0;
  let body;
  console.error = (...args) => { logArgs = args; };
  try {
    errorHandler({ code: 'E_TEST' }, { requestId: 'request-test' }, {
      headersSent: false,
      status(code) { this.statusCode = code; return this; },
      json(value) { sends += 1; body = value; }
    }, () => {});
    assert.equal(sends, 1);
    assert.equal(body.status, 500);
    assert.equal(body.message, 'Internal Server Error');
    assert.equal(logArgs[0], '[request-test]');
    assert.match(logArgs[1], /Non-Error rejection/);
    assert.notEqual(logArgs[1], undefined);
  } finally { console.error = original; }
});

test('already-sent responses delegate errors instead of attempting a second write', () => {
  let nextError;
  let sends = 0;
  errorHandler(new Error('downstream error'), { requestId: 'request-test' }, {
    headersSent: true,
    status() { sends += 1; return this; },
    json() { sends += 1; }
  }, (error) => { nextError = error; });
  assert.equal(sends, 0);
  assert.equal(nextError.message, 'downstream error');
});
