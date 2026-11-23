import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';

// Only loaded by the disposable harness and tests. Runtime routes never select this provider.
export function mockIssueCloudinary() {
  const state = { assets: new Map(), destroyed: [], uploadAttempts: 0, failUpload: 0, failDestroy: false };
  const upload = cloudinary.uploader.upload_stream;
  const destroy = cloudinary.uploader.destroy;
  const originalFetch = globalThis.fetch;
  const verify = ({ type, resource_type, public_id }) => {
    assert.equal(type, 'authenticated');
    assert.equal(resource_type, 'image');
    if (public_id) assert.match(public_id, /^campusswap\/campus-issues\/evidence\/[\da-f]{24}\/[\da-f]{24}$/);
  };
  cloudinary.uploader.upload_stream = (options, callback) => {
    verify(options);
    assert.equal(options.overwrite, false);
    const chunks = [];
    return new Writable({
      write(chunk, _encoding, done) { chunks.push(chunk); done(); },
      final(done) {
        const id = options.public_id;
        state.assets.set(id, Buffer.concat(chunks));
        state.uploadAttempts++;
        // Simulate an upload that succeeds remotely but fails before the acknowledgement.
        if (state.uploadAttempts === state.failUpload) callback(new Error('Mock upload failure'));
        else callback(null, { public_id: id, type: 'authenticated', resource_type: 'image', format: 'webp' });
        done();
      }
    });
  };
  cloudinary.uploader.destroy = async (id, options) => {
    verify({ ...options, public_id: id });
    state.destroyed.push(id);
    if (state.failDestroy) throw new Error('Mock destroy failure');
    return { result: state.assets.delete(id) ? 'ok' : 'not found' };
  };
  globalThis.fetch = (input, options) => {
    const url = new URL(input);
    if (url.hostname !== 'api.cloudinary.com') return originalFetch(input, options);
    assert.match(url.pathname, /^\/v1_1\/[\w-]+\/image\/download$/);
    const expiry = Number(url.searchParams.get('expires_at')) - Math.floor(Date.now() / 1000);
    assert.ok(expiry > 0 && expiry <= 60);
    assert.ok(url.searchParams.get('signature'));
    assert.equal(options.redirect, 'error');
    verify({ type: url.searchParams.get('type'), resource_type: 'image', public_id: url.searchParams.get('public_id') });
    const asset = state.assets.get(url.searchParams.get('public_id'));
    return Promise.resolve(new Response(asset ?? '', {
      status: asset ? 200 : 404, headers: { 'Content-Type': 'image/webp' }
    }));
  };
  return Object.assign(state, { restore() {
    cloudinary.uploader.upload_stream = upload;
    cloudinary.uploader.destroy = destroy;
    globalThis.fetch = originalFetch;
  } });
}
