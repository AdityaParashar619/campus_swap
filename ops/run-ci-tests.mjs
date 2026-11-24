import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const [mode] = process.argv.slice(2);
assert.ok(['backend', 'chromium'].includes(mode), 'Choose backend or chromium');

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = resolve(root, 'backend');
const frontend = resolve(root, 'frontend');
for (const directory of [root, backend, frontend]) {
  assert.ok(!readdirSync(directory).some(name =>
    /^\.env(?:\.|$)/.test(name) && !name.endsWith('.example')),
  'Use a separate worktree without real environment files');
}

const container = process.env.CI_TEST_MONGO_CONTAINER;
assert.ok(/^[a-f0-9]{12,64}$/.test(container ?? ''), 'Supply the disposable MongoDB container ID');
const [mongo] = JSON.parse(execFileSync('docker', ['inspect', container], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
}));
assert.equal(mongo.State.Health?.Status, 'healthy', 'Wait for MongoDB container health');
const ports = mongo.NetworkSettings.Ports['27017/tcp'];
assert.ok(mongo.Config.Image === 'mongo:8' &&
  mongo.HostConfig.Tmpfs?.['/data/db'] !== undefined &&
  mongo.HostConfig.Tmpfs?.['/data/configdb'] !== undefined &&
  ports?.some(binding => binding.HostIp === '127.0.0.1' && binding.HostPort === '27019'),
'CI MongoDB must use temporary storage and bind only to the expected loopback port');
assert.ok(ports.every(binding => binding.HostIp === '127.0.0.1'),
  'Do not expose the disposable MongoDB port off-host');
assert.ok(!mongo.Mounts.some(mount => mount.Type === 'volume' || mount.Type === 'bind'),
  'CI MongoDB cannot use persistent mounts');

const operatingSystem = /^(?:PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|HOME|USERPROFILE|TMP|TEMP|TMPDIR|LOCALAPPDATA|APPDATA|PLAYWRIGHT_BROWSERS_PATH)$/i;
const session = randomUUID().replaceAll('-', '');
const networkGuard = resolve(root, 'ops/ci-loopback-only.cjs').split(sep).join('/');
const database = name => 'mongodb://127.0.0.1:27019/' + name;
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => operatingSystem.test(key))),
  CI: 'true',
  CAMPUSSWAP_CI_TEST: '1',
  NODE_OPTIONS: `--require="${networkGuard}"`,
  NODE_ENV: 'test',
  JWT_SECRET: 'ci-synthetic-signing-key-' + session,
  OTP_PEPPER: 'ci-synthetic-otp-key-' + session,
  OTP_MOCK_ENABLED: 'true',
  EMAIL_PROVIDER: 'resend',
  ADMIN_BOOTSTRAP_ENABLED: 'false',
  SEED_ON_STARTUP: 'false',
  MONGO_URI: database('campusswap_ci_default_' + session + '_test')
};

const children = new Set();
function launch(cwd, args, overrides = {}) {
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...overrides }, windowsHide: true });
  const result = { child, output: '' };
  children.add(child);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => { result.output += chunk; });
  child.stderr.resume(); // Raw fixture output can contain synthetic session material.
  result.finished = once(child, 'close').then(([code]) => code);
  result.finished.catch(() => {}); // Readiness checks report startup errors.
  child.once('close', () => children.delete(child));
  return result;
}

async function ready(name, process, url) {
  for (let attempt = 0; attempt < 45; attempt++) {
    if (process.child.exitCode !== null || process.child.signalCode) {
      throw new Error(`${name} fixture exited before readiness (${process.child.exitCode ?? process.child.signalCode})`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch {
      // The fixture may still be binding its port.
    }
    await delay(500);
  }
  throw new Error(name + ' fixture never became ready');
}

async function stopFixtures() {
  const pending = [...children];
  for (const child of pending) child.kill();
  await Promise.race([
    Promise.allSettled(pending.map(child => once(child, 'close'))),
    delay(3000, undefined, { ref: false })
  ]);
  for (const child of children) child.kill('SIGKILL');
}

process.once('SIGTERM', () => { void stopFixtures(); });
process.once('SIGINT', () => { void stopFixtures(); });

const fixture = launch(backend, ['test-support/campusIssueBrowserServer.js'], {
  CAMPUS_ISSUE_E4_BROWSER_MONGO_URI: database('campusswap_e4_browser_' + session + '_test')
});
const proxyPort = mode === 'backend' ? '5189' : '8094';
const proxy = launch(frontend, [
  'node_modules/vite/bin/vite.js', '--config', 'ci.vite.config.js', '--port', proxyPort
]);
const proxyUrl = 'http://127.0.0.1:' + proxyPort;

try {
  await ready('Backend', fixture, 'http://127.0.0.1:5194/api/health');
  await ready('Vite proxy', proxy, proxyUrl + '/api/health');
  await ready('Frontend', proxy, proxyUrl + '/');

  if (mode === 'backend') {
    const require = createRequire(resolve(backend, 'package.json'));
    const { MongoClient } = require('mongoose').mongo;
    const otpDatabase = 'campusswap_otp_index_rehearsal_test';
    const mongoClient = new MongoClient(database(otpDatabase), { serverSelectionTimeoutMS: 5000 });
    try {
      await mongoClient.db().collection('emailverifications').createIndex({ email: 1, kind: 1 }, { unique: true });
    } finally {
      await mongoClient.close();
    }

    const socketUrl = 'http://127.0.0.1:5198';
    const socket = launch(backend, ['--input-type=module', '-e', [
      "import { httpServer } from './server.js';",
      "import mongoose from 'mongoose';",
      'await mongoose.connect(process.env.MONGO_URI);',
      "httpServer.listen(5198, '127.0.0.1');"
    ].join('\n')], {
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://127.0.0.1:8081',
      ACCESS_TOKEN_TTL: '3s',
      MONGO_URI: database('campusswap_ci_socket_' + session + '_test')
    });
    await ready('Socket.IO', socket, socketUrl + '/api/health');

    const suite = launch(backend, ['--test', '--test-concurrency=4', '--test-reporter=tap'], {
      TEST_MONGO_URI: database('campusswap_ci_' + session + '_test'),
      ADMIN_ROTATION_TEST_MONGO_URI: database('campusswap_admin_rotation_test'),
      CAMPUS_ISSUE_TEST_MONGO_URI: database('campusswap_issues_test'),
      CAMPUS_ISSUE_E4_TEST_MONGO_URI: database('campusswap_e4_integration_test'),
      CAMPUS_ISSUE_STARTUP_TEST_MONGO_URI: database('campusswap_issue_init_test'),
      CAMPUS_LOCATION_TEST_MONGO_URI: database('campusswap_locations_test'),
      DEPLOYMENT_INDEX_TEST_MONGO_URI: database('campusswap_demo'),
      OTP_INDEX_REHEARSAL_URI: database(otpDatabase),
      CORS_PROXY_TEST_URL: proxyUrl,
      PHASE44B_SOCKET_URL: socketUrl
    });
    const code = await suite.finished;
    for (const line of suite.output.split(/\r?\n/)) {
      if (/^# (?:tests|pass|fail|cancelled|skipped|todo) \d+$|^\s*not ok \d+ - /.test(line)) {
        console.log(line.replace(/^\s*/, ''));
      }
    }
    assert.ok(code === 0 && /^# tests [1-9]\d*$/m.test(suite.output) &&
      /^# pass [1-9]\d*$/m.test(suite.output) && /^# skipped 0$/m.test(suite.output) &&
      /^# cancelled 0$/m.test(suite.output) && /^# todo 0$/m.test(suite.output),
    'Backend CI requires a complete run without failures or skipped tests');
  } else {
    const suite = launch(frontend, [
      'node_modules/@playwright/test/cli.js', 'test', '--project=chromium', '--workers=1', '--reporter=json'
    ], {
      E2E_BASE_URL: proxyUrl,
      E2E_BACKEND_URL: 'http://127.0.0.1:5194',
      CAMPUS_ISSUE_E4_BROWSER: '1'
    });
    const code = await suite.finished;
    let report;
    try {
      report = JSON.parse(suite.output);
    } catch {
      throw new Error('Chromium did not produce a test report. Check the browser installation and fixture readiness.');
    }
    const showFailures = suites => {
      for (const item of suites) {
        for (const spec of item.specs ?? []) {
          if (!spec.ok) console.log('Failed Chromium test:', spec.file, spec.line, spec.title);
        }
        showFailures(item.suites ?? []);
      }
    };
    showFailures(report.suites ?? []);
    const { expected, unexpected, flaky, skipped } = report.stats;
    console.log(`Chromium: ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped`);
    assert.ok(code === 0 && expected > 0 && unexpected === 0 && flaky === 0 && skipped === 0,
      'Chromium CI requires a complete run without failures or skipped tests');
  }
} finally {
  await stopFixtures();
}
