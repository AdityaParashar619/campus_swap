import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { getMyAcademicResources } from '../controllers/academicController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import AcademicResource from '../models/AcademicResource.js';
import User from '../models/User.js';

const invoke = (handler, req) => new Promise((resolve, reject) => handler(req, { status: () => ({ json: resolve }) }, reject));

test('academic authentication rejects a request without a bearer token', async () => {
  const error = await new Promise((resolve) => authMiddleware({ headers: {} }, {}, resolve));
  assert.equal(error.status, 401);
  assert.match(error.message, /No token/i);
});

test('personalized academic controller ignores client identity overrides', async () => {
  const originalFindById = User.findById;
  const originalResourceFind = AcademicResource.find;
  const userId = new mongoose.Types.ObjectId();
  let resourceQuery;
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: userId, branch: 'ce', department: 'CE', semester: '5' }) }) });
  AcademicResource.find = (query) => {
    resourceQuery = query;
    return { sort: () => ({ lean: async () => [] }) };
  };
  try {
    const body = await invoke(getMyAcademicResources, { user: { userId: userId.toString() }, query: { branch: 'cs', program: 'CSE', department: 'CSE', semester: '1' } });
    assert.equal(body.success, true);
    assert.equal(body.data.identity.registrationBranch, 'ce');
    assert.equal(body.data.identity.programCode, 'CE');
    assert.equal(body.data.identity.semester, '5');
    assert.deepEqual(resourceQuery.semester.$in, ['5', null]);
    assert.ok(resourceQuery.$or.some((scope) => scope.programCode === 'CE'));
    assert.equal(resourceQuery.$or.some((scope) => scope.programCode === 'CSE'), false);
  } finally {
    User.findById = originalFindById;
    AcademicResource.find = originalResourceFind;
  }
});
