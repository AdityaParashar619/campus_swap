import assert from 'node:assert/strict';
import test from 'node:test';

process.env.JWT_SECRET ||= 'isolated-listing-test-secret';
process.env.NODE_ENV = 'test';

const [{ default: Listing }, { default: ProductImage }, { default: User }, { default: Bounty }, { createListing, updateListing, deleteListing, getListings }, { getBounties }, { setListingHiddenStatus }, { serializePublicProfile }, { hasPermission }] = await Promise.all([
  import('../models/Listing.js'),
  import('../models/ProductImage.js'),
  import('../models/User.js'),
  import('../models/Bounty.js'),
  import('../controllers/listingController.js'),
  import('../controllers/bountyController.js'),
  import('../controllers/adminController.js').then(({ setListingHiddenStatus }) => ({ setListingHiddenStatus })),
  import('../utils/connections.js'),
  import('../utils/permissions.js')
]);

const invoke = (handler, req, res = {}) => new Promise((resolve) => {
  res.json ||= (body) => { res.body = body; resolve({ res }); };
  res.status ||= (status) => { res.statusCode = status; return res; };
  const next = (error) => resolve({ res, error });
  handler(req, res, next);
});

test('listing owner can update editable fields with owner-scoped atomic query', { concurrency: false }, async () => {
  const originalFind = Listing.findOne;
  const original = Listing.findOneAndUpdate;
  let args;
  Listing.findOne = async () => ({ availability: 'available' });
  Listing.findOneAndUpdate = async (...values) => { args = values; return { title: 'Updated', user: 'owner-a' }; };
  try {
    const { res, error } = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body: { title: 'Updated' } });
    assert.equal(error, undefined);
    assert.equal(res.body.data.title, 'Updated');
    assert.deepEqual(args[0], { _id: 'listing-1', user: 'owner-a', availability: 'available' });
    assert.deepEqual(args[1], { $set: { title: 'Updated' } });
    assert.equal(args[2].runValidators, true);
  } finally { Listing.findOne = originalFind; Listing.findOneAndUpdate = original; }
});

test('listing update rejects ownership and server-managed fields without a write', { concurrency: false }, async () => {
  const original = Listing.findOneAndUpdate;
  let writes = 0;
  Listing.findOneAndUpdate = async () => { writes += 1; return null; };
  try {
    for (const body of [{ user: 'owner-b' }, { isHidden: true }, { favoritesCount: 500 }, { createdAt: new Date() }]) {
      const { error } = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body });
      assert.equal(error.status, 400);
    }
    assert.equal(writes, 0);
  } finally { Listing.findOneAndUpdate = original; }
});

test('non-owner cannot update or delete another user listing', { concurrency: false }, async () => {
  const originalFind = Listing.findOne;
  const originalUpdate = Listing.findOneAndUpdate;
  const originalDelete = Listing.findOneAndDelete;
  let updateFilter;
  let deleteFilter;
  Listing.findOneAndUpdate = async (filter) => { updateFilter = filter; return null; };
  Listing.findOne = async () => null;
  Listing.findOneAndDelete = async (filter) => { deleteFilter = filter; return null; };
  try {
    const req = { user: { userId: 'owner-b' }, params: { id: 'listing-1' }, body: { title: 'Hijack' } };
    const updated = await invoke(updateListing, req);
    const deleted = await invoke(deleteListing, req);
    assert.equal(updated.error.status, 404);
    assert.equal(deleted.error.status, 404);
    assert.equal(updateFilter, undefined);
    assert.deepEqual(deleteFilter, { _id: 'listing-1', user: 'owner-b' });
  } finally {
    Listing.findOneAndUpdate = originalUpdate;
    Listing.findOne = originalFind;
    Listing.findOneAndDelete = originalDelete;
  }
});

test('valid listing creation normalizes fields, derives owner, and forces available status', { concurrency: false }, async () => {
  const original = Listing.prototype.save;
  let payload;
  Listing.prototype.save = async function save() { payload = this.toObject(); return this; };
  try {
    const ownerId = '507f1f77bcf86cd799439011';
    const { res, error } = await invoke(createListing, { user: { userId: ownerId }, body: { title: '  Calculator  ', category: 'electronics', condition: 'good', price: 499.999, availability: 'sold' } });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(payload.title, 'Calculator');
    assert.equal(payload.category, 'Electronics');
    assert.equal(payload.price, 500);
    assert.equal(payload.availability, 'available');
    assert.equal(payload.user.toString(), ownerId);
  } finally { Listing.prototype.save = original; }
});

test('listing creation rejects malformed, excessive, and protected values without writing', { concurrency: false }, async () => {
  const original = Listing.prototype.save;
  let writes = 0;
  Listing.prototype.save = async () => { writes += 1; };
  try {
    const invalidBodies = [
      { title: ' ' }, { title: 'x'.repeat(121) }, { title: 'Item', price: -1 },
      { title: 'Item', price: Number.POSITIVE_INFINITY }, { title: 'Item', price: '10' },
      { title: 'Item', category: 'unsupported' }, { title: 'Item', tags: Array(11).fill('tag') },
      { title: 'Item', images: ['x'.repeat(2049)] }, { title: 'Item', user: 'attacker' }
    ];
    for (const body of invalidBodies) {
      const { error } = await invoke(createListing, { user: { userId: 'owner-a' }, body });
      assert.equal(error.status, 400);
    }
    assert.equal(writes, 0);
  } finally { Listing.prototype.save = original; }
});

test('listing creation attaches only an approved pending image owned by the seller', { concurrency: false }, async () => {
  const originals = { save: Listing.prototype.save, find: ProductImage.find, updateMany: ProductImage.updateMany };
  const ownerId = '507f1f77bcf86cd799439011';
  const imageId = '507f1f77bcf86cd799439012';
  const url = 'https://res.cloudinary.com/test/image/upload/item.jpg';
  let reserved;
  Listing.prototype.save = async function save() { return this; };
  ProductImage.find = async () => [{ _id: imageId, secureUrl: url, owner: { toString: () => ownerId }, status: 'pending', listing: null, expiresAt: new Date(Date.now() + 60_000) }];
  ProductImage.updateMany = async (filter, update) => { reserved = { filter, update }; return { modifiedCount: 1 }; };
  try {
    const { res, error } = await invoke(createListing, { user: { userId: ownerId }, body: { title: 'Item', images: [url] } });
    assert.equal(error, undefined);
    assert.deepEqual(res.body.listing.images, [url]);
    assert.equal(reserved.update.$set.status, 'attached');
  } finally { Listing.prototype.save = originals.save; ProductImage.find = originals.find; ProductImage.updateMany = originals.updateMany; }
});

test('listing edit preserves and reorders legacy image strings without claiming ownership', { concurrency: false }, async () => {
  const originals = { listingFind: Listing.findOne, listingUpdate: Listing.findOneAndUpdate, imageFind: ProductImage.find };
  const first = 'https://legacy.example/one.jpg'; const second = 'https://legacy.example/two.jpg';
  Listing.findOne = async () => ({ _id: 'listing-1', availability: 'available', images: [first, second] });
  Listing.findOneAndUpdate = async (_filter, update) => ({ images: update.$set.images });
  ProductImage.find = async () => [];
  try {
    const { res, error } = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body: { images: [second, first] } });
    assert.equal(error, undefined);
    assert.deepEqual(res.body.data.images, [second, first]);
  } finally { Listing.findOne = originals.listingFind; Listing.findOneAndUpdate = originals.listingUpdate; ProductImage.find = originals.imageFind; }
});

test('listing status can become sold once but terminal states cannot be reopened', { concurrency: false }, async () => {
  const originalFind = Listing.findOne;
  const originalUpdate = Listing.findOneAndUpdate;
  Listing.findOneAndUpdate = async (_filter, update) => ({ availability: update.$set.availability });
  try {
    Listing.findOne = async () => ({ availability: 'available' });
    const sold = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body: { availability: 'sold' } });
    assert.equal(sold.error, undefined);
    assert.equal(sold.res.body.data.availability, 'sold');
    Listing.findOne = async () => ({ availability: 'sold' });
    const reopened = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body: { availability: 'available' } });
    assert.equal(reopened.error.status, 400);
  } finally { Listing.findOne = originalFind; Listing.findOneAndUpdate = originalUpdate; }
});

test('listing update rejects a concurrent status change instead of overwriting it', { concurrency: false }, async () => {
  const originalFind = Listing.findOne;
  const originalUpdate = Listing.findOneAndUpdate;
  Listing.findOne = async () => ({ availability: 'available' });
  Listing.findOneAndUpdate = async () => null;
  try {
    const { error } = await invoke(updateListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' }, body: { availability: 'sold' } });
    assert.equal(error.status, 400);
    assert.match(error.message, /changed while it was being updated/);
  } finally { Listing.findOne = originalFind; Listing.findOneAndUpdate = originalUpdate; }
});

test('owner deletion removes saved listing references after deleting the listing', { concurrency: false }, async () => {
  const originalDelete = Listing.findOneAndDelete;
  const originalUpdateMany = User.updateMany;
  let cleanup;
  Listing.findOneAndDelete = async () => ({ _id: 'listing-1' });
  User.updateMany = async (...args) => { cleanup = args; };
  try {
    const { res, error } = await invoke(deleteListing, { user: { userId: 'owner-a' }, params: { id: 'listing-1' } });
    assert.equal(error, undefined);
    assert.equal(res.body.message, 'Listing deleted');
    assert.deepEqual(cleanup, [{ savedListings: 'listing-1' }, { $pull: { savedListings: 'listing-1' } }]);
  } finally { Listing.findOneAndDelete = originalDelete; User.updateMany = originalUpdateMany; }
});

const fakeQuery = (items) => ({
  populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; },
  lean() { return this; },
  then(resolve, reject) { return Promise.resolve(items).then(resolve, reject); }
});

test('anonymous listing and bounty feeds omit email and contact fields', { concurrency: false }, async () => {
  const originals = { listingFind: Listing.find, listingCount: Listing.countDocuments, bountyFind: Bounty.find, bountyCount: Bounty.countDocuments };
  const data = { title: 'item', user: { name: 'Campus user', email: 'private@satiengg.in', phoneNumber: '123', whatsappNumber: '456', contactVisibility: 'connections' } };
  Listing.find = () => fakeQuery([data]);
  Listing.countDocuments = async () => 1;
  Bounty.find = () => fakeQuery([{ toObject: () => data }]);
  Bounty.countDocuments = async () => 1;
  try {
    const listings = await invoke(getListings, { query: {} });
    const bounties = await invoke(getBounties, { query: {} });
    for (const item of [...listings.res.body.data, ...bounties.res.body.data]) {
      assert.equal(item.user.email, undefined);
      assert.equal(item.user.phoneNumber, undefined);
      assert.equal(item.user.whatsappNumber, undefined);
    }
  } finally {
    Listing.find = originals.listingFind;
    Listing.countDocuments = originals.listingCount;
    Bounty.find = originals.bountyFind;
    Bounty.countDocuments = originals.bountyCount;
  }
});

test('contact serializer reveals contact only to connections when visibility allows it', () => {
  const profile = { name: 'User', email: 'user@satiengg.in', phoneNumber: '123', whatsappNumber: '456', contactVisibility: 'connections' };
  assert.equal(serializePublicProfile(profile).email, undefined);
  assert.equal(serializePublicProfile(profile, { isConnected: true }).email, profile.email);
  assert.equal(serializePublicProfile({ ...profile, contactVisibility: 'private' }, { isConnected: true }).email, undefined);
});

test('admin report queue follows the explicit grievances review permission map', () => {
  assert.equal(hasPermission({ role: 'student' }, 'grievances:review'), false);
  assert.equal(hasPermission({ role: 'alumni' }, 'grievances:review'), false);
  assert.equal(hasPermission({ role: 'admin' }, 'grievances:review'), true);
  assert.equal(hasPermission({ role: 'college_admin' }, 'grievances:review'), false);
  assert.equal(hasPermission({ role: 'super_admin' }, 'grievances:review'), true);
});

test('authorized marketplace moderator can use the separate listing moderation update', { concurrency: false }, async () => {
  const original = Listing.findByIdAndUpdate;
  let update;
  Listing.findByIdAndUpdate = async (_id, value, options) => { update = { value, options }; return { _id: 'listing-1', isHidden: value.isHidden }; };
  try {
    assert.equal(hasPermission({ role: 'marketplace_moderator' }, 'marketplace:moderate'), true);
    const { res, error } = await invoke(setListingHiddenStatus, { params: { id: 'listing-1' }, body: { isHidden: true }, user: { userId: 'moderator', role: 'marketplace_moderator' } });
    assert.equal(error, undefined);
    assert.equal(res.body.data.isHidden, true);
    assert.deepEqual(update.value, { isHidden: true });
    assert.equal(update.options.runValidators, true);
    const invalid = await invoke(setListingHiddenStatus, { params: { id: 'listing-1' }, body: { isHidden: 'false' }, user: { userId: 'moderator', role: 'marketplace_moderator' } });
    assert.equal(invalid.error.status, 400);
  } finally { Listing.findByIdAndUpdate = original; }
});
