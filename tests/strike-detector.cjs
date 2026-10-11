const { test } = require('node:test');
const assert = require('node:assert/strict');
const Detector = require('../dist/strike-detector.js');
const zone = { id: 'snare', x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
const point = (x, y, name = 'pointer', handId = 'hand-1') => ({ id: `${handId}:${name}`, handId, x, y });
function detector() { const d = new Detector(); d.radiusScale = 1; return d; }

test('touching the radius from any direction triggers, including slow side entry', () => {
  for (const [a, b] of [[[0.3, 0.5], [0.45, 0.5]], [[0.5, 0.7], [0.5, 0.55]], [[0.7, 0.5], [0.55, 0.5]]]) {
    const d = detector();
    d.update([point(...a)], [zone], 0);
    assert.equal(d.update([point(...b)], [zone], 150).length, 1);
  }
});

test('five simultaneous points from one hand cause one sound per drum contact', () => {
  const d = detector();
  const points = x => ['palm','pinky','middle','pointer','thumb'].map(name => point(x, 0.5, name));
  d.update(points(0.3), [zone], 0);
  assert.equal(d.update(points(0.48), [zone], 50).length, 1);
  assert.equal(d.update(points(0.49), [zone], 200).length, 0);
});

test('pinky alone can hit while pointer is absent', () => {
  const d = detector();
  d.update([point(0.3, 0.5, 'pinky')], [zone], 0);
  assert.equal(d.update([point(0.5, 0.5, 'pinky')], [zone], 50).length, 1);
});

test('leave the radius then reenter to play another sound', () => {
  const d = detector();
  d.update([point(0.3, 0.5)], [zone], 0);
  assert.equal(d.update([point(0.48, 0.5)], [zone], 50).length, 1);
  assert.equal(d.update([point(0.48, 0.5)], [zone], 100).length, 0);
  d.update([point(0.3, 0.5)], [zone], 150);
  assert.equal(d.update([point(0.48, 0.5)], [zone], 200).length, 1);
});

test('fast movement through the whole radius still produces a hit', () => {
  const d = detector();
  d.update([point(0.2, 0.5)], [zone], 0);
  assert.equal(d.update([point(0.8, 0.5)], [zone], 50).length, 1);
});

test('radius corners and paths outside the ellipse do not hit', () => {
  const d = detector();
  d.update([point(0.2, 0.61)], [zone], 0);
  assert.equal(d.update([point(0.8, 0.61)], [zone], 50).length, 0);
});

test('two hands can hit the same drum independently', () => {
  const d = detector();
  const points = x => [point(x, 0.5), point(x, 0.5, 'pinky', 'hand-2')];
  d.update(points(0.3), [zone], 0);
  assert.equal(d.update(points(0.48), [zone], 50).length, 2);
});

test('new or reacquired points inside a drum do not create phantom hits', () => {
  const d = detector();
  assert.equal(d.update([point(0.5, 0.5)], [zone], 0).length, 0);
  d.update([], [zone], 20);
  assert.equal(d.update([point(0.5, 0.5)], [zone], 40).length, 0);
});

test('boundary jitter does not repeatedly rearm a held contact', () => {
  const d = detector();
  d.update([point(0.3, 0.5)], [zone], 0);
  assert.equal(d.update([point(0.405, 0.5)], [zone], 50).length, 1);
  d.update([point(0.395, 0.5)], [zone], 150);
  assert.equal(d.update([point(0.405, 0.5)], [zone], 250).length, 0);
});

test('radius size changes both collision coverage and invalid inputs are ignored', () => {
  const d = detector(); d.radiusScale = 1.5;
  d.update([point(0.2, 0.5)], [zone], 0);
  assert.equal(d.update([point(0.36, 0.5)], [zone], 50).length, 1);
  assert.deepEqual(d.update([point(NaN, 0.5)], [zone], 100), []);
});
