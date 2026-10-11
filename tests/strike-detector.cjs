const { test } = require('node:test');
const assert = require('node:assert/strict');
const Detector = require('../dist/strike-detector.js');
const zone = { id: 'snare', x: 0.5, y: 0.5, width: 0.2, height: 0.2 };
const point = (x, y, name = 'pointer', handId = 'hand-1') => ({ id: `${handId}:${name}`, handId, x, y });
const nodes = (x, y, handId = 'hand-1') => ['pointer'].map(name => point(x, y, name, handId));
function detector() { const d = new Detector(); d.radiusScale = 1; return d; }

test('touching the radius from any direction triggers, including slow side entry', () => {
  for (const [a, b] of [[[0.3, 0.5], [0.45, 0.5]], [[0.5, 0.7], [0.5, 0.55]], [[0.7, 0.5], [0.55, 0.5]]]) {
    const d = detector();
    d.update(nodes(...a), [zone], 0);
    assert.equal(d.update(nodes(...b), [zone], 150).length, 1);
  }
});

test('five simultaneous points from one hand cause one sound per drum contact', () => {
  const d = detector();
  const points = x => ['palm','pinky','middle','pointer','thumb'].map(name => point(x, 0.5, name));
  d.update(points(0.3), [zone], 0);
  assert.equal(d.update(points(0.48), [zone], 50).length, 1);
  assert.equal(d.update(points(0.49), [zone], 200).length, 0);
});

test('one point is enough to play a drum', () => {
  const d = detector();
  d.update([point(0.3, 0.5, 'pinky')], [zone], 0);
  assert.equal(d.update([point(0.5, 0.5, 'pinky')], [zone], 50).length, 1);
});

test('leave the radius then reenter to play another sound', () => {
  const d = detector();
  d.update(nodes(0.3, 0.5), [zone], 0);
  assert.equal(d.update(nodes(0.48, 0.5), [zone], 50).length, 1);
  assert.equal(d.update(nodes(0.48, 0.5), [zone], 100).length, 0);
  d.update(nodes(0.3, 0.5), [zone], 150);
  assert.equal(d.update(nodes(0.48, 0.5), [zone], 200).length, 1);
});

test('fast movement through the whole radius still produces a hit', () => {
  const d = detector();
  d.update(nodes(0.2, 0.5), [zone], 0);
  assert.equal(d.update(nodes(0.8, 0.5), [zone], 50).length, 1);
});

test('radius corners and paths outside the ellipse do not hit', () => {
  const d = detector();
  d.update(nodes(0.2, 0.61), [zone], 0);
  assert.equal(d.update(nodes(0.8, 0.61), [zone], 50).length, 0);
});

test('two hands can hit the same drum independently', () => {
  const d = detector();
  const points = x => [...nodes(x, 0.5), ...nodes(x, 0.5, 'hand-2')];
  d.update(points(0.3), [zone], 0);
  assert.equal(d.update(points(0.48), [zone], 50).length, 2);
});

test('new or reacquired points inside a drum do not create phantom hits', () => {
  const d = detector();
  assert.equal(d.update(nodes(0.5, 0.5), [zone], 0).length, 0);
  d.update([], [zone], 20);
  assert.equal(d.update(nodes(0.5, 0.5), [zone], 40).length, 0);
});

test('boundary jitter does not repeatedly rearm a held contact', () => {
  const d = detector();
  d.update(nodes(0.3, 0.5), [zone], 0);
  assert.equal(d.update(nodes(0.405, 0.5), [zone], 50).length, 1);
  d.update(nodes(0.395, 0.5), [zone], 150);
  assert.equal(d.update(nodes(0.405, 0.5), [zone], 250).length, 0);
});

test('radius size changes both collision coverage and invalid inputs are ignored', () => {
  const d = detector(); d.radiusScale = 1.5;
  d.update(nodes(0.2, 0.5), [zone], 0);
  assert.equal(d.update(nodes(0.36, 0.5), [zone], 50).length, 1);
  assert.deepEqual(d.update([point(NaN, 0.5)], [zone], 100), []);
});

test('single points from different hands trigger independently', () => {
  const d = detector();
  const input = x => [point(x, 0.5), point(x, 0.5, 'thumb', 'hand-2')];
  d.update(input(0.3), [zone], 0);
  assert.equal(d.update(input(0.5), [zone], 50).length, 2);
});

test('a resting palm does not block a moving fingertip', () => {
  const d = detector();
  const input = x => [point(0.5, 0.5, 'middle'), point(x, 0.5, 'thumb')];
  d.update(input(0.3), [zone], 0);
  assert.equal(d.update(input(0.5), [zone], 50).length, 1);
  assert.equal(d.update(input(0.5), [zone], 150).length, 0);
});

test('multiple swept paths produce one hit per hand in a frame', () => {
  const d = detector();
  const names = ['middle', 'thumb'];
  d.update([0.39,-0.3].map((x,i)=>point(x,0.5,names[i])), [zone], 0);
  assert.equal(d.update([1.39,0.7].map((x,i)=>point(x,0.5,names[i])), [zone], 50).length, 1);
});

test('duplicate point IDs produce only one hit', () => {
  const d = detector();
  d.update(Array(3).fill(point(0.3, 0.5)), [zone], 0);
  assert.equal(d.update(Array(3).fill(point(0.5, 0.5)), [zone], 50).length, 1);
});

test('default hit radius matches drum bounds', () => {
  assert.equal(new Detector().radiusScale, 1);
});

test('tilted drum ellipse rejects points above the flattened head', () => {
  const tilted = { ...zone, height: 0.08 };
  const d = detector();
  d.update(nodes(0.2, 0.56), [tilted], 0);
  assert.equal(d.update(nodes(0.5, 0.56), [tilted], 50).length, 0);
  assert.equal(d.update(nodes(0.5, 0.5), [tilted], 100).length, 1);
});

test('single-frame dropout preserves an observed crossing without inventing hits', () => {
  const d = detector();
  d.update(nodes(0.3, 0.5), [zone], 0);
  assert.equal(d.update([], [zone], 16).length, 0);
  assert.equal(d.update(nodes(0.5, 0.5), [zone], 32).length, 1);
  d.update([], [zone], 48);
  assert.equal(d.update(nodes(0.5, 0.5), [zone], 64).length, 0);
});

test('long dropout does not connect stale points into a strike', () => {
  const d = detector();
  d.update(nodes(0.3, 0.5), [zone], 0);
  d.update([], [zone], 16);
  assert.equal(d.update(nodes(0.5, 0.5), [zone], 200).length, 0);
});

test('rapid 60 ms strokes do not drop beats while another point rests inside', () => {
  const d = detector();
  const input = x => [point(x, 0.5), point(0.5, 0.5, 'palm')];
  let hits = 0;
  for (let i = 0; i < 40; i++) hits += d.update(input(i % 2 ? 0.5 : 0.3), [zone], i * 30).length;
  assert.equal(hits, 20);
});
