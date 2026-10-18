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


test('cross-screen ring draws on both adjoining displays without assuming the center is local', () => {
  const left = { x:-1200,y:0,width:1200,height:800 };
  const right = { x:0,y:0,width:1600,height:900 };
  const a = { x:-8,y:200,shape:'ring',width:120,height:80 };
  assert.equal(localAnnotations(left, [a]).length, 1);
  assert.equal(localAnnotations(right, [a])[0].x, -8);
  assert.equal(canLocateAll([left,right],[a]), true);
});
