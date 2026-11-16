import assert from 'node:assert/strict';
import test from 'node:test';
import Listing from '../models/Listing.js';
import User from '../models/User.js';
import { addFavoriteListing, getFavoriteStatuses, getSavedListings, reconcileFavoriteCount, removeFavoriteListing } from '../controllers/listingController.js';

const invoke = (handler, req) => new Promise((resolve) => { const res = { json(body) { this.body = body; resolve({ res: this }); } }; handler(req, res, (error) => resolve({ res, error })); });
const selected = (value) => ({ select() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const listQuery = (value) => ({ populate() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const listingId = '507f1f77bcf86cd799439011';

test('idempotent favorite add increments count only when membership changes', { concurrency: false }, async () => {
  const originals = { find: Listing.findOne, userUpdate: User.updateOne, listingUpdate: Listing.updateOne }; let countUpdates = 0; let memberships = 0;
  Listing.findOne = () => selected({ _id: listingId }); User.updateOne = async () => ({ modifiedCount: memberships++ === 0 ? 1 : 0 }); Listing.updateOne = async () => { countUpdates += 1; };
  try { const first = await invoke(addFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } }); const duplicate = await invoke(addFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } }); assert.equal(first.res.body.data.changed, true); assert.equal(duplicate.res.body.data.changed, false); assert.equal(countUpdates, 1); }
  finally { Listing.findOne = originals.find; User.updateOne = originals.userUpdate; Listing.updateOne = originals.listingUpdate; }
});

test('concurrent favorite adds cannot duplicate membership or count increments', { concurrency: false }, async () => {
  const originals = { find: Listing.findOne, userUpdate: User.updateOne, listingUpdate: Listing.updateOne }; let member = false; let increments = 0;
  Listing.findOne = () => selected({ _id: listingId }); User.updateOne = async () => { if (member) return { modifiedCount: 0 }; member = true; return { modifiedCount: 1 }; }; Listing.updateOne = async () => { increments += 1; };
  try { await Promise.all([invoke(addFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } }), invoke(addFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } })]); assert.equal(increments, 1); }
  finally { Listing.findOne = originals.find; User.updateOne = originals.userUpdate; Listing.updateOne = originals.listingUpdate; }
});

test('favorite removal is idempotent and uses a non-negative atomic count update', { concurrency: false }, async () => {
  const originals = { userUpdate: User.updateOne, listingUpdate: Listing.updateOne }; let update;
  User.updateOne = async () => ({ modifiedCount: 1 }); Listing.updateOne = async (...args) => { update = args; };
  try { const { res } = await invoke(removeFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } }); assert.equal(res.body.data.isFavorite, false); assert.equal(Array.isArray(update[1]), true); }
  finally { User.updateOne = originals.userUpdate; Listing.updateOne = originals.listingUpdate; }
});

test('hidden listings cannot be newly favorited', { concurrency: false }, async () => {
  const original = Listing.findOne; Listing.findOne = () => selected(null);
  try { const { error } = await invoke(addFavoriteListing, { user: { userId: 'owner-a' }, params: { id: listingId } }); assert.equal(error.status, 404); }
  finally { Listing.findOne = original; }
});

test('favorite status and saved feed are scoped to the authenticated user', { concurrency: false }, async () => {
  const originals = { userFind: User.findById, listingFind: Listing.find, count: Listing.countDocuments };
  User.findById = () => selected({ savedListings: [listingId] }); Listing.find = (filter) => { assert.deepEqual(filter._id, { $in: [listingId] }); return listQuery([]); }; Listing.countDocuments = async () => 0;
  try { const status = await invoke(getFavoriteStatuses, { user: { userId: 'owner-a' }, body: { listingIds: [listingId] } }); assert.equal(status.res.body.data[listingId], true); const saved = await invoke(getSavedListings, { user: { userId: 'owner-a' }, query: {} }); assert.equal(saved.error, undefined); }
  finally { User.findById = originals.userFind; Listing.find = originals.listingFind; Listing.countDocuments = originals.count; }
});

test('favorite count reconciliation derives count from savedListings source of truth', { concurrency: false }, async () => {
  const originals = { count: User.countDocuments, update: Listing.updateOne }; let value; User.countDocuments = async () => 7; Listing.updateOne = async (_filter, update) => { value = update.$set.favoritesCount; };
  try { assert.equal(await reconcileFavoriteCount(listingId), 7); assert.equal(value, 7); }
  finally { User.countDocuments = originals.count; Listing.updateOne = originals.update; }
});

