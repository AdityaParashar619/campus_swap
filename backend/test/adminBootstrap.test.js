import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-admin-bootstrap-test-secret';
process.env.NODE_ENV = 'test';

const [{ env }, { ensureAdminUser }, { default: User }, { default: RefreshSession }] = await Promise.all([
  import('../config/env.js'),
  import('../scripts/ensureAdmin.js'),
  import('../models/User.js'),
  import('../models/RefreshSession.js')
]);

test('unchanged bootstrap admin is not saved, logged, or token-invalidated on repeated sync', { concurrency: false }, async () => {
  const originals = {
    env: { adminEmail: env.adminEmail, adminPassword: env.adminPassword, superAdminEmail: env.superAdminEmail, superAdminPassword: env.superAdminPassword },
    findOne: User.findOne,
    revoke: RefreshSession.updateMany,
    log: console.log
  };
  Object.assign(env, { adminEmail: 'admin@satiengg.in', adminPassword: 'unchanged-test-password', superAdminEmail: '', superAdminPassword: '' });
  const existing = { _id: 'admin-id', role: 'admin', accountType: 'staff', accountStatus: 'active', emailVerified: true, verificationStatus: 'verified', isBlocked: false, tokenVersion: 7, password: 'preexisting-hash', saveCalls: 0, async save() { this.saveCalls += 1; } };
  let revocations = 0;
  let logs = 0;
  User.findOne = async () => existing;
  RefreshSession.updateMany = async () => { revocations += 1; };
  console.log = () => { logs += 1; };
  try {
    await ensureAdminUser();
    await ensureAdminUser();
    assert.equal(existing.saveCalls, 0);
    assert.equal(existing.tokenVersion, 7);
    assert.equal(existing.password, 'preexisting-hash');
    assert.equal(revocations, 0);
    assert.equal(logs, 0);
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.findOne; RefreshSession.updateMany = originals.revoke; console.log = originals.log;
  }
});

test('bootstrap security-state change invalidates sessions exactly once and never replaces the password', { concurrency: false }, async () => {
  const originals = {
    env: { adminEmail: env.adminEmail, adminPassword: env.adminPassword, superAdminEmail: env.superAdminEmail, superAdminPassword: env.superAdminPassword },
    findOne: User.findOne,
    revoke: RefreshSession.updateMany,
    log: console.log
  };
  Object.assign(env, { adminEmail: 'admin@satiengg.in', adminPassword: 'must-not-overwrite-existing', superAdminEmail: '', superAdminPassword: '' });
  const existing = { _id: 'admin-id', role: 'student', accountType: 'student', accountStatus: 'active', emailVerified: true, verificationStatus: 'verified', isBlocked: false, tokenVersion: 2, password: 'original-hash', saveCalls: 0, async save() { this.saveCalls += 1; } };
  let revocations = 0;
  User.findOne = async () => existing;
  RefreshSession.updateMany = async () => { revocations += 1; };
  console.log = () => {};
  try {
    await ensureAdminUser();
    assert.equal(existing.role, 'admin');
    assert.equal(existing.accountType, 'staff');
    assert.equal(existing.tokenVersion, 3);
    assert.equal(existing.password, 'original-hash');
    assert.equal(existing.saveCalls, 1);
    assert.equal(revocations, 1);
    await ensureAdminUser();
    assert.equal(existing.tokenVersion, 3);
    assert.equal(existing.saveCalls, 1);
    assert.equal(revocations, 1);
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.findOne; RefreshSession.updateMany = originals.revoke; console.log = originals.log;
  }
});

test('bootstrap preserves an explicitly blocked administrator and does not downgrade an existing super-administrator', { concurrency: false }, async () => {
  const originals = {
    env: { adminEmail: env.adminEmail, adminPassword: env.adminPassword, superAdminEmail: env.superAdminEmail, superAdminPassword: env.superAdminPassword },
    findOne: User.findOne,
    revoke: RefreshSession.updateMany,
    log: console.log
  };
  Object.assign(env, { adminEmail: 'admin@satiengg.in', adminPassword: 'unchanged-password', superAdminEmail: '', superAdminPassword: '' });
  const existing = { _id: 'admin-id', role: 'super_admin', accountType: 'staff', accountStatus: 'blocked', emailVerified: false, verificationStatus: 'rejected', isBlocked: true, tokenVersion: 4, password: 'existing-hash', saveCalls: 0, async save() { this.saveCalls += 1; } };
  let revocations = 0;
  User.findOne = async () => existing;
  RefreshSession.updateMany = async () => { revocations += 1; };
  console.log = () => {};
  try {
    await ensureAdminUser();
    assert.equal(existing.role, 'super_admin');
    assert.equal(existing.accountStatus, 'blocked');
    assert.equal(existing.isBlocked, true);
    assert.equal(existing.emailVerified, false);
    assert.equal(existing.verificationStatus, 'rejected');
    assert.equal(existing.tokenVersion, 4);
    assert.equal(existing.saveCalls, 0);
    assert.equal(revocations, 0);
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.findOne; RefreshSession.updateMany = originals.revoke; console.log = originals.log;
  }
});

test('bootstrap creates a missing admin account using a hash without overwriting accounts', { concurrency: false }, async () => {
  const originals = {
    env: { adminEmail: env.adminEmail, adminPassword: env.adminPassword, superAdminEmail: env.superAdminEmail, superAdminPassword: env.superAdminPassword },
    findOne: User.findOne,
    create: User.create,
    log: console.log
  };
  Object.assign(env, { adminEmail: 'new-admin@satiengg.in', adminPassword: 'brand-new-test-password', superAdminEmail: '', superAdminPassword: '' });
  let created;
  User.findOne = async () => null;
  User.create = async (data) => { created = data; };
  console.log = () => {};
  try {
    await ensureAdminUser();
    assert.equal(created.email, 'new-admin@satiengg.in');
    assert.notEqual(created.password, env.adminPassword);
    assert.equal(created.role, 'admin');
  } finally {
    Object.assign(env, originals.env);
    User.findOne = originals.findOne; User.create = originals.create; console.log = originals.log;
  }
});
