import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET = 'isolated-server-bootstrap-test-secret';
process.env.NODE_ENV = 'test';

const [{ connectDatabaseInBackground }, { default: mongoose }, { default: User }] = await Promise.all([
  import('../server.js'),
  import('mongoose'),
  import('../models/User.js')
]);

test('healthy database retry ticks do not rerun administrator bootstrap', { concurrency: false }, async () => {
  const previousState = mongoose.connection.readyState;
  const originalFindOne = User.findOne;
  let adminLookups = 0;
  mongoose.connection.readyState = 1;
  User.findOne = async () => { adminLookups += 1; return null; };
  try {
    await connectDatabaseInBackground();
    await connectDatabaseInBackground();
    assert.equal(adminLookups, 0);
  } finally {
    mongoose.connection.readyState = previousState;
    User.findOne = originalFindOne;
  }
});
