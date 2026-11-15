import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const loadConfig = (overrides = {}) => spawnSync(process.execPath, ['--input-type=module', '-e', "import('./config/env.js')"], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    JWT_SECRET: 'institution-config-test-secret',
    INSTITUTION_EMAIL_PATTERN: '^[a-z]+[0-9]{2}(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{3}@satiengg\\.in$',
    ENROLLMENT_PATTERN: '^0108(cs|bc|ai|ds|it|iot|ec|ce|me|ee)[0-9]{2}(10|11)[0-9]{2}$',
    INSTITUTION_BRANCHES: 'cs,bc,ai,ds,it,iot,ec,ce,me,ee',
    ...overrides
  }
});

test('institution identity patterns fail closed when malformed or missing the configured branch', () => {
  const malformed = loadConfig({ INSTITUTION_EMAIL_PATTERN: '[' });
  assert.notEqual(malformed.status, 0);
  assert.match(malformed.stderr, /INSTITUTION_EMAIL_PATTERN and ENROLLMENT_PATTERN/);

  const mismatch = loadConfig({ INSTITUTION_BRANCHES: 'it', INSTITUTION_EMAIL_PATTERN: '^[a-z]+[0-9]{2}cs[0-9]{3}@satiengg\\.in$' });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /INSTITUTION_EMAIL_PATTERN and ENROLLMENT_PATTERN/);

  const invalidBranches = loadConfig({ INSTITUTION_BRANCHES: 'cs,cs' });
  assert.notEqual(invalidBranches.status, 0);
  assert.match(invalidBranches.stderr, /INSTITUTION_BRANCHES must contain only unique supported/);

  const unsupportedBranch = loadConfig({ INSTITUTION_BRANCHES: 'cs,xx' });
  assert.notEqual(unsupportedBranch.status, 0);
  assert.match(unsupportedBranch.stderr, /INSTITUTION_BRANCHES must contain only unique supported/);
});
