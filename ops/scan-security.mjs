import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = '0.76.2';
const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const dockerfiles = ['Dockerfile.same-origin', 'backend/Dockerfile', 'frontend/Dockerfile'];
const lockfiles = ['backend/package-lock.json', 'frontend/package-lock.json'];
const [scope, cache, image, sbom, ...extra] = process.argv.slice(2);

class ScanError extends Error {}

function requireCheck(condition, stage) {
  if (!condition) throw new ScanError(stage);
}

function run(program, args, stage, cwd, env = process.env) {
  const result = spawnSync(program, args, {
    cwd, env, encoding: 'utf8', timeout: 360_000, maxBuffer: 8 * 1024 * 1024
  });
  // Tool output can contain secret matches or untrusted application text.
  requireCheck(result.status === 0 && !result.error, stage);
  return result.stdout;
}

function readJson(path, stage) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new ScanError(stage);
  }
}

function snapshot(destination) {
  const files = execFileSync('git', ['ls-files', '-z', '--cached'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  }).split('\0').filter(Boolean);
  const pendingTools = ['ops/scan-security.mjs', 'docs/CAMPUSSWAP_PHASE_5_0D_2_DEVSECOPS.md'];
  for (const path of new Set([...files, ...pendingTools.filter(path => existsSync(join(root, path)))])) {
    const privatePath = /(^|\/)(\.git|\.npmrc|\.netrc|backups?|mongodump|private-(?:attachments|evidence)|test-results|playwright-report)(\/|$)|\.(?:archive|zip|bson)$/i;
    const envFile = /(^|\/)\.env[^/]*$/i.test(path);
    requireCheck(!privatePath.test(path) && (!envFile || path.endsWith('.example')), 'tracked scan scope contains a private path');
    const source = join(root, path);
    requireCheck(lstatSync(source).isFile(), 'tracked scan scope must contain ordinary files');
    const target = join(destination, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
}

function insideWorktree(path) {
  const rel = relative(root, resolve(path));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\'));
}

function safeText(value, pattern) {
  return typeof value === 'string' && pattern.test(value) ? value : undefined;
}

function findings(report, mode) {
  let blockers = 0;
  let reviewRequired = 0;
  const imageReport = ['image', 'compose-backend', 'compose-frontend'].includes(mode);
  const totals = Object.fromEntries(severityOrder.map(level => [level, 0]));
  const kinds = { secret: 0, vulnerability: 0, misconfiguration: 0 };
  for (const result of report.Results) {
    const displayTarget = mode === 'repo-dockerfiles' ? result.Target.replace(/\/Dockerfile$/, '') : result.Target;
    const target = safeText(displayTarget, /^[a-zA-Z0-9_.@/+(): -]{1,180}$/);
    for (const [items, kind] of [
      [result.Secrets, 'secret'],
      [result.Vulnerabilities, 'vulnerability'],
      [result.Misconfigurations?.filter(item => item.Status === 'FAIL'), 'misconfiguration']
    ]) {
      for (const item of items ?? []) {
        const severity = severityOrder.includes(item.Severity) ? item.Severity : 'UNKNOWN';
        const fixed = safeText(item.FixedVersion, /^[a-zA-Z0-9_.~+,: -]{1,150}$/);
        const blocking = kind === 'secret' || severity === 'CRITICAL' ||
          (severity === 'HIGH' && (kind === 'misconfiguration' || Boolean(item.FixedVersion?.trim())));
        const review = kind === 'vulnerability' && severity === 'HIGH' && !blocking;
        totals[severity]++;
        kinds[kind]++;
        if (blocking) blockers++;
        if (review) reviewRequired++;
        const path = item.StartLine ?? item.CauseMetadata?.StartLine;
        const component = imageReport && kind === 'vulnerability'
          ? result.Class === 'os-pkgs' ? 'OS packages' :
            item.PkgPath?.startsWith('usr/local/lib/node_modules/npm/') ? 'base image npm CLI' : 'Node.js packages'
          : undefined;
        console.log(JSON.stringify({
          kind, severity, blocking,
          review: review || undefined,
          id: safeText(item.RuleID ?? item.VulnerabilityID ?? item.ID, /^[a-zA-Z0-9_-]{1,80}$/) ?? 'unknown',
          target: kind === 'secret' && imageReport ? undefined : target,
          line: Number.isSafeInteger(path) && path > 0 ? path : undefined,
          component,
          package: kind === 'vulnerability' ? safeText(item.PkgName, /^[a-zA-Z0-9_.@/+:-]{1,120}$/) : undefined,
          installed: kind === 'vulnerability' ? safeText(item.InstalledVersion, /^[a-zA-Z0-9_.~+:-]{1,100}$/) : undefined,
          fixed
        }));
      }
    }
  }
  console.log(JSON.stringify({ scope: mode, totals, kinds, blockers, reviewRequired }));
  return blockers;
}

function main(scratch) {
  requireCheck(!extra.length && cache && ['repo', 'image', 'compose-backend', 'compose-frontend'].includes(scope) &&
    (scope === 'repo' ? !image : image) && (!sbom || (scope === 'image' && !insideWorktree(sbom))),
  'usage: scan-security.mjs repo CACHE | image CACHE IMAGE [SBOM_OUTSIDE_WORKTREE] | compose-backend/compose-frontend CACHE IMAGE');
  requireCheck(!insideWorktree(cache), 'scanner cache must be outside the publication worktree');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^TRIVY_/i.test(key)));
  const scan = (stage, [command, ...args]) => run('trivy', [
    command, '--cache-dir', resolve(cache), '--disable-telemetry', '--skip-version-check', ...args
  ], stage, scratch, env);
  requireCheck(run('trivy', ['--version'], 'Trivy installation', scratch, env)
    .split(/\r?\n/).includes(`Version: ${version}`),
    `Trivy ${version} required`);

  function report(stage, command, args) {
    const output = join(scratch, `${stage}.json`);
    const options = command === 'config' ? [] : ['--no-progress'];
    scan(stage, [command, '--format', 'json', '--output', output, ...options, ...args]);
    const data = readJson(output, stage);
    requireCheck(data.SchemaVersion === 2 && Array.isArray(data.Results), stage);
    return data;
  }

  function initializeDatabase() {
    scan('vulnerability database initialization', ['image', '--download-db-only', '--no-progress']);
    const db = readJson(join(resolve(cache), 'db', 'metadata.json'), 'vulnerability database metadata');
    const updated = new Date(db.UpdatedAt).valueOf();
    const age = Date.now() - updated;
    requireCheck(db.Version === 2 && Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= 48 * 60 * 60 * 1000,
      'vulnerability database is missing a usable recent update');
    console.log(`Trivy ${version} vulnerability database updated ${new Date(updated).toISOString()}`);
  }

  function scanSecrets(target, stage) {
    const output = join(scratch, `${stage}.json`);
    scan(stage, ['fs', '--scanners', 'secret', '--format', 'json', '--output', output, '--no-progress', target]);
    const data = readJson(output, stage);
    requireCheck(data.SchemaVersion === 2 && data.ArtifactType === 'filesystem' &&
      (data.Results == null || Array.isArray(data.Results)), stage);
    data.Results ??= [];
    return data;
  }

  if (scope === 'repo') {
    const source = join(scratch, 'source');
    snapshot(source);
    // Secret detection runs first, even if a package database is unavailable.
    if (findings(scanSecrets(source, 'repository secret scan'), 'repo-secrets')) return 1;

    initializeDatabase();
    const dependencies = report('repository-dependencies', 'fs', [
      '--scanners', 'vuln', '--include-dev-deps', '--list-all-pkgs', source
    ]);
    for (const lockfile of lockfiles) {
      requireCheck(dependencies.Results.some(result => result.Target === lockfile && result.Type === 'npm' &&
        result.Packages?.length > 0), 'repository dependency coverage');
    }
    const config = join(scratch, 'config');
    for (const dockerfile of dockerfiles) {
      const target = join(config, dockerfile, 'Dockerfile');
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(source, dockerfile), target);
    }
    const configuration = report('repository-dockerfiles', 'config', [
      '--misconfig-scanners', 'dockerfile', '--include-non-failures', '--skip-check-update', config
    ]);
    for (const dockerfile of dockerfiles) {
      requireCheck(configuration.Results.some(result => result.Target === `${dockerfile}/Dockerfile` &&
        result.Type === 'dockerfile' && result.Misconfigurations?.length > 0), 'Dockerfile scan coverage');
    }
    const dependencyBlockers = findings(dependencies, 'repo-dependencies');
    const configBlockers = findings(configuration, 'repo-dockerfiles');
    return dependencyBlockers || configBlockers ? 1 : 0;
  }

  const imageID = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image], 'local image inspection', scratch).trim();
  requireCheck(/^sha256:[a-f0-9]{64}$/.test(imageID), 'local image identity');
  initializeDatabase();
  const production = report('production-image', 'image', [
    '--image-src', 'docker', '--scanners', 'vuln,secret', '--image-config-scanners', 'secret',
    '--list-all-pkgs', imageID
  ]);
  const osPackages = production.Results.find(result => result.Class === 'os-pkgs')?.Packages ?? [];
  const expectedPackage = scope === 'compose-frontend'
    ? osPackages.some(pkg => pkg.Name === 'nginx')
    : production.Results.some(result => result.Class === 'lang-pkgs' && result.Type === 'node-pkg' &&
      result.Packages?.some(pkg => pkg.Name === 'express'));
  requireCheck(production.Metadata?.ImageID === imageID && osPackages.length > 0 && expectedPackage,
    'production image package coverage');
  console.log(`Scanned local ${scope} artifact ${imageID}`);
  const blockers = findings(production, scope);
  const secretCount = production.Results.reduce((count, result) => count + (result.Secrets?.length ?? 0), 0);
  if (sbom && !secretCount) {
    const artifact = join(scratch, 'image.cdx.json');
    scan('CycloneDX generation', [
      'image', '--image-src', 'docker', '--format', 'cyclonedx', '--output', artifact, '--no-progress', imageID
    ]);
    const document = readJson(artifact, 'CycloneDX validation');
    const component = document.metadata?.component;
    const identifiesImage = component?.name === imageID ||
      component?.properties?.some(property => property.value === imageID);
    requireCheck(document.bomFormat === 'CycloneDX' && document.specVersion && component?.type === 'container' &&
      identifiesImage && document.components?.some(pkg => pkg.name === 'express') &&
      document.components?.some(pkg => pkg.purl?.startsWith('pkg:apk/')) &&
      (document.vulnerabilities == null || document.vulnerabilities.length === 0),
    'CycloneDX image identity and component coverage');
    if (findings(scanSecrets(artifact, 'CycloneDX secret scan'), 'sbom-secrets')) return 1;
    writeFileSync(resolve(sbom), readFileSync(artifact), { flag: 'wx', mode: 0o600 });
    console.log(`CycloneDX ${document.specVersion} validated for ${imageID} (${document.components.length} components)`);
  }
  return blockers ? 1 : 0;
}

const scratch = mkdtempSync(join(tmpdir(), 'campusswap-security-'));
try {
  process.exitCode = main(scratch);
  console.log(process.exitCode === 1 ? 'Security policy failed.' : 'Security policy passed.');
} catch (error) {
  // Only messages created by this script are safe for hosted logs.
  const stage = error instanceof ScanError ? error.message : 'scanner input/output';
  console.error(`Security scanner execution failed: ${stage}.`);
  process.exitCode = 2;
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
