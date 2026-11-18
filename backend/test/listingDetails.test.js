import assert from 'node:assert/strict';
import test from 'node:test';
import Listing from '../models/Listing.js';
import Message from '../models/Message.js';
import { getListingById, getMyListings } from '../controllers/listingController.js';
import { sendMessage } from '../controllers/messageController.js';

const invoke = (handler, req) => new Promise((resolve) => {
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; resolve({ res: this }); } };
  handler(req, res, (error) => resolve({ res, error }));
});
const query = (value) => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });

test('product details reject malformed IDs before querying MongoDB', { concurrency: false }, async () => {
  const original = Listing.findOne; let queried = false; Listing.findOne = () => { queried = true; };
  try { const { error } = await invoke(getListingById, { params: { id: 'not-an-id' } }); assert.equal(error.status, 400); assert.equal(queried, false); }
  finally { Listing.findOne = original; }
});

test('product details return 404 for missing and hidden listings through the visibility-scoped query', { concurrency: false }, async () => {
  const original = Listing.findOne; let filter; Listing.findOne = (value) => { filter = value; return query(null); };
  try { const { error } = await invoke(getListingById, { params: { id: '507f1f77bcf86cd799439011' } }); assert.equal(error.status, 404); assert.deepEqual(filter, { _id: '507f1f77bcf86cd799439011', isHidden: { $ne: true } }); }
  finally { Listing.findOne = original; }
});

test('product details expose approved seller fields and server-derived verification only', { concurrency: false }, async () => {
  const original = Listing.findOne;
  const seller = { _id: 'owner-a', name: 'Seller', profilePicture: '', email: 'private@example.com', phoneNumber: '123', trustScore: 99, emailVerified: true, verificationStatus: 'verified' };
  const listing = { user: seller, toObject: () => ({ _id: 'listing-1', title: 'Calculator', images: ['https://legacy/image.jpg'], user: seller }) };
  Listing.findOne = () => query(listing);
  try { const { res, error } = await invoke(getListingById, { params: { id: '507f1f77bcf86cd799439011' } }); assert.equal(error, undefined); assert.deepEqual(res.body.data.user, { _id: 'owner-a', name: 'Seller', profilePicture: '', verifiedInstitutionalAccount: true }); assert.deepEqual(res.body.data.images, ['https://legacy/image.jpg']); }
  finally { Listing.findOne = original; }
});

test('verification indicator requires both verified email and verified account status', { concurrency: false }, async () => {
  const original = Listing.findOne;
  const seller = { _id: 'owner-a', name: 'Seller', emailVerified: true, verificationStatus: 'pending' };
  Listing.findOne = () => query({ user: seller, toObject: () => ({ user: seller }) });
  try { const { res } = await invoke(getListingById, { params: { id: '507f1f77bcf86cd799439011' } }); assert.equal(res.body.data.user.verifiedInstitutionalAccount, false); }
  finally { Listing.findOne = original; }
});

test('My Listings derives owner from the authenticated session and never accepts another owner', { concurrency: false }, async () => {
  const originals = { find: Listing.find, count: Listing.countDocuments }; let findFilter; let countFilter;
  Listing.find = (filter) => { findFilter = filter; return query([]); }; Listing.countDocuments = async (filter) => { countFilter = filter; return 0; };
  try { const { res, error } = await invoke(getMyListings, { user: { userId: 'owner-a' }, query: { page: '1' } }); assert.equal(error, undefined); assert.equal(findFilter.user, 'owner-a'); assert.deepEqual(findFilter, countFilter); assert.deepEqual(res.body.pagination, { page: 1, limit: 12, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }); }
  finally { Listing.find = originals.find; Listing.countDocuments = originals.count; }
});

test('chat rejects self-contact before access or message writes', { concurrency: false }, async () => {
  const original = Message.create; let writes = 0; Message.create = async () => { writes += 1; };
  try { const { error } = await invoke(sendMessage, { user: { userId: 'owner-a' }, body: { receiverId: 'owner-a', text: 'Hello' }, app: { locals: {} } }); assert.equal(error.status, 400); assert.equal(writes, 0); }
  finally { Message.create = original; }
});

