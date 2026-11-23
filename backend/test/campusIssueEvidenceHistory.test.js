import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { sanitizeIssuePhotos } from '../services/campusIssueEvidence.js';
import { normalizeIssue, parseIssueList } from '../utils/campusIssueValidation.js';

const fixture = { title: 'Fixture', description: 'Synthetic content', category: 'water' };
const image = (format, width = 14, height = 8) => sharp({
  create: { width, height, channels: 3, background: 'white' }
}).toFormat(format).toBuffer();

for (const format of ['jpeg', 'png', 'webp']) {
  test(`decodes ${format}, applies orientation, and stores metadata-free WebP`, async () => {
    const buffer = await sharp(await image(format)).withMetadata({ orientation: 6 })
      .toFormat(format).toBuffer();
    const [photo] = await sanitizeIssuePhotos([{ buffer, mimetype: `image/${format}` }]);
    const result = await sharp(photo.buffer).metadata();
    assert.equal(result.format, 'webp');
    assert.equal(result.width, 8);
    assert.equal(result.height, 14);
    for (const field of ['exif', 'xmp', 'icc', 'orientation']) assert.equal(result[field], undefined);
    assert.equal(photo.metadata.sizeBytes, photo.buffer.length);
  });
}

test('rejects excess files, byte size, spoofing, unsupported formats, corrupt data, and excessive pixels', async () => {
  const file = { buffer: await image('png'), mimetype: 'image/png' };
  const giant = { ...file, buffer: await image('png', 5000, 4100) };
  for (const files of [
    [], [file, file, file, file], [{ ...file, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }],
    [{ ...file, mimetype: 'image/jpeg' }], [{ ...file, mimetype: 'image/gif' }],
    [{ ...file, buffer: file.buffer.subarray(0, 30) }], [giant]
  ]) await assert.rejects(sanitizeIssuePhotos(files), { status: 400 });
});

test('history cutoff is inclusive at exactly 168 hours and composes with status, category and search', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const cutoff = new Date('2026-11-16T10:00:00Z');
  const history = parseIssueList({ view: 'history', status: 'resolved', category: 'water', search: 'fixture', page: '2', limit: '1' }, true, now);
  assert.deepEqual(history.filter.$and, [{ $or: [
    { status: 'resolved', resolvedAt: { $lte: cutoff } },
    { status: 'closed', closedAt: { $lte: cutoff } }
  ] }]);
  assert.deepEqual(parseIssueList({}, true, now).filter.$and, [{ $nor: history.filter.$and[0].$or }]);
  assert.equal(history.filter.status, 'resolved');
  assert.equal(history.filter.category, 'water');
  assert.equal(history.filter.$or[0].title.test('Fixture 1'), true);
  assert.equal(history.skip, 1);
  assert.throws(() => parseIssueList({ view: 'history' }), { status: 400 });
  assert.throws(() => parseIssueList({ view: 'invalid' }, true), { status: 400 });
});

test('ordinary student input cannot mark reports, inject evidence IDs, or control visibility timestamps', () => {
  for (const field of ['testFixture', 'evidenceCloud', 'evidenceStage', 'attachments', 'evidence', 'submissionKey', 'resolvedAt', 'cleanupPendingAt']) {
    assert.throws(() => normalizeIssue({ ...fixture, [field]: 'injected' }), { status: 400 });
  }
});
