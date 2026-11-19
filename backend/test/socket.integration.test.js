import assert from 'node:assert/strict';
import test from 'node:test';
import { io } from 'socket.io-client';

const baseUrl = process.env.PHASE44B_SOCKET_URL;
const password = 'Socket-Test-Password!27';

const request = async (path, { token, cookie, body, method = body ? 'POST' : 'GET' } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}), origin: 'http://127.0.0.1:8081' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return { data, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
};

const register = async (suffix, roll) => {
  const email = `socket${suffix}27cs0${roll}@satiengg.in`;
  const registration = await request('/api/auth/register/student', { body: { name: `Socket Student ${suffix}`, email, enrollmentNumber: `0108cs2710${roll}`, department: 'CSE', branch: 'cs', semester: '7', phoneNumber: '9876543210', password, confirmPassword: password } });
  const preview = await request('/api/auth/dev-mail-preview', { body: { previewToken: registration.data.devMailPreviewToken } });
  const verified = await request('/api/auth/verify-email', { body: { email, otp: preview.data.code } });
  return { email, id: verified.data.user.id, token: verified.data.token, cookie: verified.cookie };
};

const once = (socket, event, timeout = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
  socket.once(event, (value) => { clearTimeout(timer); resolve(value); });
});

test('real Socket.IO clients isolate rooms, authorize typing, recover expiry, and reject revoked tokens', { skip: !baseUrl, timeout: 30000 }, async () => {
  const a = await register('socketa', '31');
  const b = await register('socketb', '32');
  const socketA = io(baseUrl, { path: '/socket.io/', auth: { token: a.token }, transports: ['websocket'] });
  const socketB = io(baseUrl, { path: '/socket.io/', auth: { token: b.token }, transports: ['websocket'] });
  await Promise.all([once(socketA, 'connect'), once(socketB, 'connect')]);

  let leaked = 0; socketA.on('notification:new', () => { leaked += 1; });
  const notification = once(socketB, 'notification:new');
  const connection = await request('/api/connections', { token: a.token, body: { recipientId: b.id } });
  assert.equal((await notification).title, 'New connection request');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(leaked, 0);
  await request(`/api/connections/${connection.data.data._id}/respond`, { token: b.token, method: 'PATCH', body: { status: 'accepted' } });

  const typing = once(socketB, 'typing');
  socketA.emit('typing', { receiverId: b.id, isTyping: true });
  assert.deepEqual(await typing, { senderId: a.id, isTyping: true });

  const messageEvent = once(socketB, 'receiveMessage');
  await request('/api/messages', { token: a.token, body: { receiverId: b.id, text: 'one real-time delivery' } });
  assert.equal((await messageEvent).text, 'one real-time delivery');

  await once(socketA, 'session:expired', 8000);
  const refreshed = await request('/api/auth/refresh', { cookie: a.cookie, method: 'POST' });
  socketA.auth = { token: refreshed.data.token }; socketA.connect();
  await once(socketA, 'connect');

  const refreshedB = await request('/api/auth/refresh', { cookie: b.cookie, method: 'POST' });
  await request('/api/auth/me/password', { token: refreshedB.data.token, method: 'PATCH', body: { currentPassword: password, password: 'Socket-New-Password!28', confirmPassword: 'Socket-New-Password!28' } });
  const revokedB = io(baseUrl, { path: '/socket.io/', auth: { token: b.token }, transports: ['websocket'], reconnection: false });
  await once(revokedB, 'connect_error');
  await request('/api/auth/logout', { cookie: refreshed.cookie, method: 'POST' });
  await new Promise((resolve) => setTimeout(resolve, 3200));
  const rejected = io(baseUrl, { path: '/socket.io/', auth: { token: refreshed.data.token }, transports: ['websocket'], reconnection: false });
  await once(rejected, 'connect_error');
  rejected.close(); revokedB.close(); socketA.close(); socketB.close();
});
