import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/campusswap';
process.env.DATABASE_CONNECT_TIMEOUT_MS = '100';

const { httpServer, startServer } = await import('../server.js');

test('server listens before an unavailable database connection completes', { concurrency: false }, async () => {
  startServer();
  await new Promise((resolve) => httpServer.once('listening', resolve));
  const { port } = httpServer.address();

  try {
    const response = await new Promise((resolve, reject) => {
      const req = httpRequest({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      });
      req.on('error', reject);
      req.end();
    });

    assert.equal(response.status, 503);
    assert.equal(response.body.status, 'DEGRADED');
  } finally {
    await new Promise((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
  }
});
