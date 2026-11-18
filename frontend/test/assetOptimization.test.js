import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const campusWebp = new URL('../src/assets/sati-campus.webp', import.meta.url);
const campusPng = new URL('../src/assets/sati-campus.png', import.meta.url);
const landingPage = new URL('../src/pages/Landing.jsx', import.meta.url);

test('landing page uses the optimized lazy campus image and preserves the source asset', async () => {
  const [optimized, original, source] = await Promise.all([
    stat(campusWebp),
    stat(campusPng),
    readFile(landingPage, 'utf8')
  ]);

  assert.ok(optimized.size < 200_000, `optimized campus image is unexpectedly large: ${optimized.size} bytes`);
  assert.ok(optimized.size < original.size * 0.1, 'optimized campus image should be at least 90% smaller');
  assert.match(source, /sati-campus\.webp/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /width="1600"/);
  assert.match(source, /height="377"/);
});
