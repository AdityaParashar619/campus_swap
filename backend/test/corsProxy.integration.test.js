import assert from 'node:assert/strict';
import test from 'node:test';
import { io } from 'socket.io-client';

const base = process.env.CORS_PROXY_TEST_URL;
const origin = 'http://localhost:5173';

test('Vite through Docker serves credentialed HTTP and authenticated Socket.IO', { skip: !base, timeout: 20000 }, async () => {
  assert.equal(base, 'http://127.0.0.1:5189', 'Use the isolated Vite proxy port');
  async function call(path, { body, cookie, token, method = 'GET', requestOrigin = origin } = {}) {
    return fetch(base + path, {
      method,
      headers: {
        origin: requestOrigin,
        ...(body && { 'content-type': 'application/json' }),
        ...(cookie && { cookie }),
        ...(token && { authorization: `Bearer ${token}` })
      },
      body: body && JSON.stringify(body)
    });
  }

  const login = await call('/api/auth/login', {
    method: 'POST', body: { email: 'cors-smoke-admin@satiengg.in', password: 'Cors-Proxy-Test!27' }
  });
  assert.equal(login.status, 200);
  assert.equal(login.headers.get('access-control-allow-origin'), origin);
  assert.equal(login.headers.get('access-control-allow-credentials'), 'true');
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.match(cookie, /^refreshToken=/);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  const { token } = await login.json();

  const profile = await call('/api/auth/me', { token });
  assert.equal(profile.status, 200);
  assert.equal((await profile.json()).data.role, 'admin');
  assert.equal((await call('/api/auth/refresh', { method: 'POST', cookie, requestOrigin: 'http://unknown.invalid' })).status, 403);
  const refresh = await call('/api/auth/refresh', { method: 'POST', cookie });
  assert.equal(refresh.status, 200);
  const refreshedToken = (await refresh.json()).token;
  assert.ok(refreshedToken);

  for (const path of ['/api/listings', '/api/admin/campus-locations']) {
    const response = await call(path, { token: refreshedToken });
    assert.equal(response.status, 200, path);
    assert.equal((await response.json()).success, true, path);
  }
  const dockerOrigin = await call('/api/live', { requestOrigin: 'http://localhost:8080' });
  assert.equal(dockerOrigin.status, 200);
  assert.equal(dockerOrigin.headers.get('access-control-allow-origin'), 'http://localhost:8080');

  const polling = await call('/socket.io/?EIO=4&transport=polling');
  assert.equal(polling.status, 200);
  assert.equal(polling.headers.get('access-control-allow-origin'), origin);
  assert.equal(polling.headers.get('access-control-allow-credentials'), 'true');
  await polling.text();
  const badPolling = await call('/socket.io/?EIO=4&transport=polling', { requestOrigin: 'http://unknown.invalid' });
  assert.equal(badPolling.headers.get('access-control-allow-origin'), null);
  assert.notEqual(badPolling.status, 200);

  async function connectWebSocket(requestOrigin) {
    const socket = io(base, {
      transports: ['websocket'], auth: { token: refreshedToken }, extraHeaders: { Origin: requestOrigin },
      reconnection: false, timeout: 5000, autoConnect: false
    });
    try {
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('connect_error', reject);
        socket.connect();
      });
      return socket.io.engine.transport.name;
    } finally {
      socket.disconnect();
    }
  }
  assert.equal(await connectWebSocket(origin), 'websocket');
  await assert.rejects(connectWebSocket('http://unknown.invalid'));

  const rotatedCookie = refresh.headers.get('set-cookie')?.split(';')[0];
  assert.match(rotatedCookie, /^refreshToken=/);
  assert.notEqual(rotatedCookie, cookie);
  assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: rotatedCookie })).status, 200);
});
