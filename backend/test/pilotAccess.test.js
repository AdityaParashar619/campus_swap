import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'pilot-access-test-secret';
process.env.NODE_ENV = 'test';

const { assertPilotRegistrationAllowed } = await import('../utils/pilotAccess.js');

test('pilot registration is unchanged when pilot mode is disabled', () => {
  assert.doesNotThrow(() => assertPilotRegistrationAllowed('student@satiengg.in', { pilotModeEnabled: false, pilotAllowedEmails: [] }));
});

test('pilot registration allowlist is normalized and enforced server-side', () => {
  const configuration = { pilotModeEnabled: true, pilotAllowedEmails: ['approved@satiengg.in'] };
  assert.doesNotThrow(() => assertPilotRegistrationAllowed(' APPROVED@satiengg.in ', configuration));
  assert.throws(() => assertPilotRegistrationAllowed('other@satiengg.in', configuration), /approved pilot participants/i);
});
