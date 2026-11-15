import assert from 'node:assert/strict';
import test from 'node:test';
import { submitStudentRegistration } from '../src/utils/studentRegistration.js';

const formData = { name: 'Existing Student', email: ' EXISTING24CS012@SATIENGG.IN ', password: 'Dont-change-this-form-value' };

test('duplicate registration displays the backend conflict message and never navigates to verification', async () => {
  const navigations = [];
  let submitted;
  const error = { response: { status: 409, data: { message: 'This email is already registered. Please log in.' } } };
  await assert.rejects(submitStudentRegistration({
    formData,
    registerStudent: async (payload) => { submitted = payload; throw error; },
    navigate: (...args) => navigations.push(args)
  }), (caught) => caught === error && caught.response.data.message === 'This email is already registered. Please log in.');
  assert.equal(submitted.email, 'existing24cs012@satiengg.in');
  assert.equal(formData.email, ' EXISTING24CS012@SATIENGG.IN ');
  assert.equal(navigations.length, 0);
});

test('new registration navigates to OTP verification only after the API succeeds', async () => {
  const navigations = [];
  await submitStudentRegistration({
    formData,
    registerStudent: async (payload) => ({ data: { devMailPreviewToken: 'capture-capability', email: payload.email } }),
    navigate: (...args) => navigations.push(args)
  });
  assert.deepEqual(navigations, [[
    '/verify-email',
    { state: { email: 'existing24cs012@satiengg.in', devMailPreviewToken: 'capture-capability' } }
  ]]);
});
