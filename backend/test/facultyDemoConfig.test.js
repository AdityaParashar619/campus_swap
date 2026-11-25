import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const base = {
  NODE_ENV: 'production',
  SERVE_FRONTEND: 'true',
  FRONTEND_URL: 'https://demo.example',
  TRUST_PROXY_HOPS: '1',
  MONGO_URI: 'mongodb://localhost:27017/campusswap_demo',
  JWT_SECRET: 'a'.repeat(32),
  OTP_PEPPER: 'b'.repeat(32),
  CAMPUSSWAP_DEMO_MODE: 'true'
};
const faculty = {
  ...base,
  CAMPUSSWAP_FACULTY_DEMO_MODE: 'true',
  EMAIL_PROVIDER: 'gmail',
  GMAIL_USER: 'fixture@example.com',
  GMAIL_APP_PASSWORD: 'a'.repeat(16),
  EMAIL_FROM: 'fixture@example.com',
  ADMIN_EMAIL: 'staff@satiengg.in',
  PILOT_MODE_ENABLED: 'true',
  PILOT_ALLOWED_EMAILS: 'student27cs011@satiengg.in',
  CLOUDINARY_CLOUD_NAME: 'fixture',
  CLOUDINARY_API_KEY: 'fixture',
  CLOUDINARY_API_SECRET: 'fixture'
};

function readConfiguration(env) {
  return spawnSync(process.execPath, ['--input-type=module', '--eval',
    'import { env } from "./config/env.js"; console.log(JSON.stringify([env.demoMode, env.facultyDemoMode]));'
  ], { cwd, env, encoding: 'utf8' });
}

test('restricted synthetic and explicitly configured faculty demos both start', () => {
  for (const [env, expected] of [
    [{ ...base, EMAIL_PROVIDER: 'disabled' }, [true, false]],
    [faculty, [true, true]]
  ]) {
    const result = readConfiguration(env);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').at(-1)), expected);
  }
});

test('faculty configuration rejects unsafe targets, identities, and switches', async (t) => {
  for (const [key, value] of [
    ['CAMPUSSWAP_DEMO_MODE', 'false'],
    ['MONGO_URI', 'mongodb://localhost:27017/campusswap'],
    ['PILOT_MODE_ENABLED', 'false'],
    ['PILOT_ALLOWED_EMAILS', 'someone@example.com'],
    ['ADMIN_EMAIL', 'student27cs011@satiengg.in'],
    ['ADMIN_PASSWORD', 'fixture-only'],
    ['ADMIN_BOOTSTRAP_ENABLED', 'true'],
    ['SEED_ON_STARTUP', 'true'],
    ['CAMPUS_ISSUE_PRIVATE_EVIDENCE_ENABLED', 'true'],
    ['EMAIL_PROVIDER', 'disabled'],
    ['OTP_MOCK_ENABLED', 'true'],
    ['CLOUDINARY_API_SECRET', '']
  ]) {
    await t.test(key, () => {
      assert.notEqual(readConfiguration({ ...faculty, [key]: value }).status, 0);
    });
  }
});
