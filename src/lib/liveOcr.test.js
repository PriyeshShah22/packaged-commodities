import test from 'node:test';
import assert from 'node:assert/strict';
import { hasReadableText, reliableLiveFields, withDeadline, encodeCameraFrame } from './liveOcr.js';

test('selected frame encoding does not wait for an idle toBlob callback', async () => {
  const canvas = { toBlob() { throw new Error('idle encoder must not run'); }, toDataURL(type, quality) { assert.equal(type, 'image/jpeg'); assert.equal(quality, .9); return 'data:image/jpeg;base64,/9j/2Q=='; } };
  const blob = encodeCameraFrame(canvas);
  assert.equal(blob.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [255, 216, 255, 217]);
});
test('an unready camera frame fails explicitly instead of sending empty data', () => {
  assert.throws(() => encodeCameraFrame({ toDataURL: () => 'data:,' }), /not ready/);
});

test('empty OCR is not success; readable text requires no predefined field', () => {
  assert.equal(hasReadableText({ images: [{ lines: [] }], fields: {} }), false);
  assert.equal(hasReadableText({ images: [{ lines: [{ text: '  ' }] }] }), false);
  assert.equal(hasReadableText({ images: [{ lines: [{ text: 'Readable package text' }] }], fields: {} }), true);
});
test('reliable fields survive a global blur warning, weak candidates do not', () => {
  const strong = { value: 'MRP ₹230.00', confidence: .96 };
  assert.deepEqual(reliableLiveFields({ images: [{ quality: { blur_status: 'high' } }], fields: { mrp: strong, batch_number: { value: '2', confidence: .4 } } }), { mrp: strong });
});
test('camera deadline settles even when encoding never calls back', async () => {
  await assert.rejects(withDeadline(() => new Promise(() => {}), 10, 'capture timeout'), /capture timeout/);
  assert.equal(await withDeadline(() => Promise.resolve('next frame'), 100, 'timeout'), 'next frame');
});
test('camera deadline propagates a real failure without keeping timers', async () => {
  await assert.rejects(withDeadline(() => { throw new Error('camera lost'); }, 100, 'timeout'), /camera lost/);
});
