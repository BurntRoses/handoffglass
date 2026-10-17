import test from 'node:test';
import assert from 'node:assert/strict';
import { validDisplay, localAnnotations, contains, canLocateAll } from '../src/geometry.mjs';
const left = { id: 'A', x: -1280, y: -50, width: 1280, height: 800 };
const primary = { id: 'B', x: 0, y: 0, width: 1920, height: 1080 };
test('secondary monitors with negative DIP positions are supported', () => {
  const p = { x: -700, y: 100, shape: 'ring' };
  assert.equal(validDisplay(left), true);
  assert.equal(contains(left, p), true);
  assert.equal(contains(primary, p), false);
  assert.deepEqual(localAnnotations(left, [p]), [{ ...p, x: 580, y: 150 }]);
  assert.equal(canLocateAll([left, primary], [p, { x: 20, y: 50 }]), true);
  assert.equal(canLocateAll([left, primary], [{ x: -4000, y: 1 }]), false);
});
test('rejects unreasonable display metadata', () => {
  assert.equal(validDisplay({ ...left, width: -1 }), false);
  assert.equal(validDisplay({ ...left, id: 1 }), false);
  assert.equal(validDisplay({ ...left, height: Infinity }), false);
});
