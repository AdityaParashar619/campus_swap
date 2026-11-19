import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-admin-bootstrap-test-secret';
process.env.NODE_ENV = 'test';

const [{ env }, { ensureAdminUser }, { default: User }] = await Promise.all([
  import('../config/env.js'), import('../scripts/ensureAdmin.js'), import('../models/User.js')
]);

const withBootstrap = async (configuration, findOne, create, action) => {
  const originals = { env: { adminBootstrapEnabled: env.adminBootstrapEnabled, adminEmail: env.adminEmail, adminPassword: env.adminPassword, superAdminEmail: env.superAdminEmail, superAdminPassword: env.superAdminPassword }, findOne: User.findOne, create: User.create, log: console.log };
  Object.assign(env, configuration); User.findOne = findOne; User.create = create; console.log = () => {};
  try { await action(); } finally { Object.assign(env, originals.env); User.findOne = originals.findOne; User.create = originals.create; console.log = originals.log; }
};

test('bootstrap is inert without explicit authorization', { concurrency: false }, async () => {
  let lookups = 0;
  await withBootstrap({ adminBootstrapEnabled: false, adminEmail: 'admin@satiengg.in', adminPassword: 'secret', superAdminEmail: '', superAdminPassword: '' }, async () => { lookups += 1; }, async () => {}, async () => {
    await ensureAdminUser(); assert.equal(lookups, 0);
  });
});

test('bootstrap refuses to mutate or overwrite any existing account', { concurrency: false }, async () => {
  const existing = { _id: 'existing-id', role: 'student', password: 'existing-hash' };
  await withBootstrap({ adminBootstrapEnabled: true, adminEmail: 'admin@satiengg.in', adminPassword: 'must-not-overwrite', superAdminEmail: '', superAdminPassword: '' }, async () => existing, async () => {}, async () => {
    await assert.rejects(ensureAdminUser(), /configured email already exists/i);
    assert.deepEqual(existing, { _id: 'existing-id', role: 'student', password: 'existing-hash' });
  });
});

test('explicit bootstrap creates exactly one missing administrator with a password hash', { concurrency: false }, async () => {
  let created;
  await withBootstrap({ adminBootstrapEnabled: true, adminEmail: 'new-admin@satiengg.in', adminPassword: 'brand-new-test-password', superAdminEmail: '', superAdminPassword: '' }, async () => null, async (data) => { created = data; }, async () => {
    await ensureAdminUser();
    assert.equal(created.email, 'new-admin@satiengg.in'); assert.notEqual(created.password, env.adminPassword); assert.equal(created.role, 'admin'); assert.equal(created.accountType, 'staff');
  });
});
