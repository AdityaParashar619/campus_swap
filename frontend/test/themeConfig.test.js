import test from 'node:test';
import assert from 'node:assert/strict';
import tailwindConfig from '../tailwind.config.js';

test('Tailwind dark variants follow the application class-based theme switcher', () => {
  assert.equal(tailwindConfig.darkMode, 'class');
});
