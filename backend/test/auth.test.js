import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = 'test-secret-that-is-not-used-outside-tests';
process.env.NODE_ENV = 'test';

const [{ createApp }, { authMiddleware }, { signAuthToken }, { default: User }, bcrypt] = await Promise.all([
  import('../app.js'),
  import('../middleware/authMiddleware.js'),
  import('../utils/auth.js'),
  import('../models/User.js'),
  import('bcrypt')
]);

const withoutDatabaseCheck = (_req, _res, next) => next();

const request = async (app, path, options = {}) => {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port,
          path,
          method: options.method || 'GET',
          headers: options.headers
        },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            body += chunk;
          });
          response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
        }
      );
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
};

test('health reports a database outage without hanging', { concurrency: false }, async () => {
  const response = await request(createApp(), '/api/health');

  assert.equal(response.status, 503);
  assert.equal(response.body.status, 'DEGRADED');
  assert.equal(response.body.database, 'disconnected');
});

test('auth validation rejects empty and malformed login payloads', { concurrency: false }, async () => {
  const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
  const emptyResponse = await request(app, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const malformedResponse = await request(app, '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'password123' })
  });

  assert.equal(emptyResponse.status, 400);
  assert.equal(emptyResponse.body.message, 'Missing required fields: email, password');
  assert.equal(malformedResponse.status, 400);
  assert.equal(malformedResponse.body.details.email, 'Please provide a valid email');
});

test('registration creates a user and rejects a duplicate account', { concurrency: false }, async () => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  let storedUser;

  User.findOne = async () => storedUser || null;
  User.create = async (data) => {
    storedUser = {
      ...data,
      _id: { toString: () => 'user-1' },
      role: 'student',
      interests: [],
      skills: [],
      contactVisibility: 'connections',
      trustScore: 0,
      isVerifiedStudent: false,
      createdAt: new Date()
    };
    return storedUser;
  };

  try {
    const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
    const payload = { name: 'Test Student', email: 'student@example.edu', enrollmentNumber: 'ENR001', password: 'password123' };
    const created = await request(app, '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const duplicate = await request(app, '/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.equal(created.status, 201);
    assert.equal(created.body.success, true);
    assert.equal(typeof created.body.token, 'string');
    assert.equal(duplicate.status, 409);
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  }
});

test('login accepts the correct password and rejects an incorrect password', { concurrency: false }, async () => {
  const originalFindOne = User.findOne;
  const user = {
    _id: { toString: () => 'user-2' },
    name: 'Test Student',
    email: 'student@example.edu',
    enrollmentNumber: 'ENR002',
    password: await bcrypt.hash('password123', 10),
    role: 'student',
    interests: [],
    skills: [],
    contactVisibility: 'connections',
    trustScore: 0,
    isVerifiedStudent: false,
    createdAt: new Date()
  };
  User.findOne = async () => user;

  try {
    const app = createApp({ databaseMiddleware: withoutDatabaseCheck });
    const valid = await request(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'password123' })
    });
    const invalid = await request(app, '/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: 'incorrect-password' })
    });

    assert.equal(valid.status, 200);
    assert.equal(typeof valid.body.token, 'string');
    assert.equal(invalid.status, 401);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('auth middleware accepts a valid token and rejects invalid or missing tokens', { concurrency: false }, async () => {
  const originalFindById = User.findById;
  User.findById = () => ({ select: async () => ({ _id: { toString: () => 'user-3' }, email: 'student@example.edu', role: 'student', isBlocked: false }) });

  const runMiddleware = (authorization) => new Promise((resolve) => {
    const req = { headers: authorization ? { authorization } : {} };
    authMiddleware(req, {}, (error) => resolve({ error, user: req.user }));
  });

  try {
    const valid = await runMiddleware(`Bearer ${signAuthToken({ userId: 'user-3', email: 'student@example.edu', role: 'student' })}`);
    const invalid = await runMiddleware('Bearer invalid-token');
    const missing = await runMiddleware();

    assert.equal(valid.error, undefined);
    assert.equal(valid.user.userId, 'user-3');
    assert.equal(invalid.error.status, 401);
    assert.equal(missing.error.status, 401);
  } finally {
    User.findById = originalFindById;
  }
});
