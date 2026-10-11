const { test } = require('node:test');
const assert = require('node:assert/strict');
const { perspectiveScale, analyzeRoom, cameraAdvice } = require('../dist/scene-guide.js');

test('bottom-center drums grow while distant and side drums shrink symmetrically', () => {
  assert.ok(perspectiveScale(0.5, 0.9) > perspectiveScale(0.5, 0.2));
  assert.ok(perspectiveScale(0.5, 0.9) > perspectiveScale(0.1, 0.9));
  assert.equal(perspectiveScale(0.1, 0.7), perspectiveScale(0.9, 0.7));
  assert.ok(perspectiveScale(0.5, 1) <= 1.5);
});

test('room analysis reports darkness without inventing an angle', () => {
  const scene = analyzeRoom(new Uint8ClampedArray(160*90*4),160,90);
  assert.equal(scene.brightness, 0);
  assert.equal(scene.rollDegrees, null);
  assert.match(cameraAdvice(scene, []), /light/i);
});

test('coherent slanted room edge produces leveling guidance', () => {
  const data = new Uint8ClampedArray(160*90*4);
  for(let y=0;y<90;y++) for(let x=0;x<160;x++) {
    const value = y > 25 + x * 0.2 ? 220 : 40;
    data.set([value,value,value,255],(y*160+x)*4);
  }
  const scene = analyzeRoom(data,160,90);
  assert.ok(scene.rollDegrees > 5);
  assert.match(cameraAdvice(scene, []), /level/i);
});

test('hand framing gives tilt direction and a no-hands setup instruction', () => {
  const scene = { brightness: 120, rollDegrees: null };
  assert.match(cameraAdvice(scene, [{x:0.5,y:0.95}]), /tilt.*down/i);
  assert.match(cameraAdvice(scene, [{x:0.5,y:0.05}]), /tilt.*up/i);
  assert.match(cameraAdvice(scene, []), /playing surface/i);
});
