import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelpChatState, buildHelpDraft, getRequestAction, preserveExistingDraft, sanitizeRequestTitle } from '../src/utils/requestView.js';

test('request actions show close for owners, offer help for others, and nothing for closed records', () => {
  const open = { status: 'open', user: { _id: 'owner' } };
  assert.equal(getRequestAction(open, 'owner'), 'close');
  assert.equal(getRequestAction(open, 'helper'), 'offer-help');
  assert.equal(getRequestAction({ ...open, status: 'closed' }, 'helper'), 'none');
});

test('Offer Help creates distinct Chat context from sanitized authoritative request data', () => {
  const request = { _id: 'request', title: '  Need   DSA notes  ', user: { _id: 'owner' } };
  assert.equal(sanitizeRequestTitle(request.title), 'Need DSA notes');
  assert.equal(buildHelpDraft(request.title), 'Hi, I saw your Community Request about Need DSA notes. I may be able to help.');
  assert.deepEqual(buildHelpChatState(request), { selectedUserId: 'owner', communityRequestContext: { requestId: 'request', title: 'Need DSA notes', draft: buildHelpDraft(request.title) } });
});

test('suggested request text never overwrites an existing unsent draft automatically', () => {
  assert.equal(preserveExistingDraft('Existing draft', 'Suggested'), 'Existing draft');
  assert.equal(preserveExistingDraft('', 'Suggested'), 'Suggested');
});
