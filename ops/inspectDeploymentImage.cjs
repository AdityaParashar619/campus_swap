const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { gunzipSync } = require('node:zlib');

const [image, localFlag, ...extra] = process.argv.slice(2);
if (!image || (localFlag && localFlag !== '--compare-local-env') || extra.length) {
  console.error('Usage: node ops/inspectDeploymentImage.cjs <image> [--compare-local-env]');
  process.exit(1);
}

function* tarEntries(buffer) {
  let pendingName;
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (start, end) => header.toString('utf8', start, end).split('\0')[0].trim();
    const size = Number.parseInt(field(124, 136), 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= buffer.length, 'Invalid image tar entry');
    const type = field(156, 157);
    const content = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') {
      pendingName = content.toString('utf8').split('\0')[0];
      continue;
    }
    const name = (pendingName || [field(345, 500), field(0, 100)].filter(Boolean).join('/')).replace(/^\.\//, '');
    pendingName = undefined;
    yield { name, type, content };
  }
}

const expected = new Set([
  'app/server.js', 'app/app.js', 'app/package.json', 'app/package-lock.json', 'app/public/index.html',
  'app/scripts/seed.js', 'app/scripts/ensureAdmin.js',
  'app/scripts/provisionDeploymentIndexes.js', 'app/scripts/provisionDemoStudent.js',
  'app/scripts/provisionFacultyDemoAdmin.js'
]);
const approvedMedia = /^app\/public\/assets\/(?:sati-campus-[\w-]+\.webp|sati-logo-[\w-]+\.jpg)$/;
const privateLayerPath = /(?:^|\/)(?:\.git|\.gitconfig|\.env[^/]*|\.npmrc|\.netrc|backups?|mongodump|credentials|secrets|private-attachments|private-evidence|test-results|playwright-report)(?:\/|$)|\.(?:archive|bson|backup|sqlite3?|p12|pfx)$/i;
const forbiddenPath = /(?:^|\/)(?:\.git|\.env[^/]*|\.npmrc|\.netrc|test-support|test-results|playwright-report|backups?|mongodump|dumps?|credentials|secrets|private-attachments|private-evidence|uploads)(?:\/|$)|\.(?:archive|bson|dump|bak|backup|sql|sqlite3?|pem|key|p12|pfx|zip|7z|tar|tgz|gz)$/i;
const patterns = [
  ['Resend-shaped API key', /\bre_[A-Za-z0-9_]{18,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\b/],
  ['private key', /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/],
  ['credential-bearing URI', /\b(?:mongodb(?:\+srv)?|cloudinary):\/\/[^\s"':/@]+:[^\s"'@]+@/i]
];

function localComparisons() {
  const comparisons = new Map();
  if (!localFlag) return comparisons;
  for (const file of ['.env', 'backend/.env']) {
    if (!fs.existsSync(file)) continue;
    for (const row of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const pair = row.match(/^\s*(ADMIN_(?:EMAIL|PASSWORD)|SUPER_ADMIN_(?:EMAIL|PASSWORD)|MONGO_URI|JWT_SECRET|OTP_PEPPER|GMAIL_(?:USER|APP_PASSWORD)|RESEND_API_KEY|CLOUDINARY_API_(?:KEY|SECRET))\s*=\s*(.*?)\s*$/);
      if (!pair) continue;
      const value = pair[2].replace(/^['"]|['"]$/g, '');
      if (pair[1] === 'MONGO_URI') {
        try {
          const password = new URL(value).password;
          if (password.length >= 8) {
            comparisons.set(password, pair[1]);
            comparisons.set(decodeURIComponent(password), pair[1]);
          }
        } catch {
          // The generic URI check still covers credential-bearing strings.
        }
        continue;
      }
      if (value.length >= 8) comparisons.set(value, pair[1]);
      if (pair[1] === 'GMAIL_APP_PASSWORD' && value.replaceAll(' ', '').length >= 8) {
        comparisons.set(value.replaceAll(' ', ''), pair[1]);
      }
    }
  }
  assert.ok(comparisons.size, 'No local comparison values were available');
  return comparisons;
}

try {
  const markers = (process.env.DEPLOYMENT_AUDIT_CANARIES ?? '').split('\n').filter(Boolean);
  const local = localComparisons();
  for (const marker of markers) {
    assert.ok(marker.length >= 16, 'Canary must be at least 16 characters');
    local.set(marker, 'synthetic exclusion canary');
  }
  const archive = execFileSync('docker', ['image', 'save', image], {
    maxBuffer: 600 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']
  });
  const outer = new Map(Array.from(tarEntries(archive), ({ name, content }) => [name, content]));
  const [manifest] = JSON.parse(outer.get('manifest.json').toString('utf8'));
  const files = new Set();
  const hits = new Map();
  const report = (name, finding) => {
    if (!hits.has(name)) hits.set(name, new Set());
    hits.get(name).add(finding);
  };
  const scanMarkers = (name, content) => {
    for (const [value, category] of local) {
      if (content.includes(value)) report(name, category);
    }
  };
  const scan = (name, content) => {
    if (content.subarray(0, 8192).includes(0)) return;
    const source = content.toString('utf8');
    for (const [value, category] of local) {
      if ((category.endsWith('_EMAIL') || category === 'GMAIL_USER') &&
          source.toLowerCase().includes(value.toLowerCase())) report(name, category);
    }
    for (const [category, pattern] of patterns) if (pattern.test(source)) report(name, category);
  };
  const config = outer.get(manifest.Config);
  scanMarkers('(image configuration)', config);
  scan('(image configuration)', config);
  for (const layer of manifest.Layers) {
    const blob = outer.get(layer);
    assert.ok(blob, 'Image manifest refers to a missing layer');
    const tar = blob[0] === 31 && blob[1] === 139 ? gunzipSync(blob) : blob;
    for (const { name, content, type } of tarEntries(tar)) {
      if (privateLayerPath.test(name)) report('(image layer)', 'private filename');
      if (type === '0' || type === '') scanMarkers('(image layer)', content);
      if ((!name.startsWith('app/') && !name.startsWith('frontend/')) || name.includes('/node_modules/')) continue;
      if (forbiddenPath.test(name)) report(name, 'forbidden runtime filename');
      if (!['', '0'].includes(type)) continue;
      files.add(name);
      if (name.startsWith('app/scripts/') && !expected.has(name)) report(name, 'unexpected runtime script');
      if (/\.(?:jpe?g|png|webp|svg|gif|pdf|docx?|mp4|webm)$/i.test(name) && !approvedMedia.test(name)) {
        report(name, 'unapproved runtime media');
      }
      scan(name, content);
    }
  }
  for (const name of expected) if (!files.has(name)) report(name, 'required file missing');
  if (![...files].some((name) => /^app\/public\/assets\/[^/]+\.js$/.test(name))) {
    report('app/public/assets', 'compiled JavaScript missing');
  }
  for (const [name, findings] of hits) console.error(name, [...findings].join(', '));
  if (hits.size) {
    process.exitCode = 1;
  } else {
    const configDigest = 'sha256:' + createHash('sha256').update(config).digest('hex');
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `config-digest=${configDigest}\n`);
    console.log('Deployment inspection passed:', manifest.Layers.length, 'layers and', files.size, 'application files.');
    console.log('Inspected image configuration:', configDigest);
  }
} catch {
  console.error('Deployment image inspection could not complete.');
  process.exitCode = 1;
}
