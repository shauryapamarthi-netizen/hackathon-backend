import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const Detector = createRequire(import.meta.url)('../dist/strike-detector.js');

async function moduleFrom(name) {
  const source = await readFile(new URL(`../dist/${name}.js`, import.meta.url), 'utf8');
  return import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
}

const { HandSession, getHandPoints } = await moduleFrom('hand-session');
const { HandInput } = await moduleFrom('hand-input');

function result() {
  return {
    landmarks: [0.2, 0.8].map(x => Array.from({ length: 21 }, () => ({ x, y: 0.4, z: 0 }))),
    handedness: [[{ categoryName: 'Left', score: 0.9 }], [{ categoryName: 'Right', score: 0.9 }]],
    worldLandmarks: [[], []]
  };
}

function ready() {
  const input = new HandInput(new HandSession(), getHandPoints);
  input.reset(0);
  for (let now = 0; now <= 800; now += 100) input.update(result(), now);
  return input;
}

test('setup cannot strike; selected hands expose all five named points for contact detection', () => {
  const input = new HandInput(new HandSession(), getHandPoints);
  input.reset(0);
  assert.deepEqual(input.update(result(), 0).strikePoints, []);
  const frame = ready().update(result(), 820);
  assert.equal(frame.overlayPoints.length, 10);
  assert.equal(frame.strikePoints.length, 10);
  assert.equal(frame.strikePoints[0].x, 0.8);
  assert.equal(frame.strikePoints[0].handId, 'hand-1');
  assert.equal(frame.strikePoints[0].name, 'palm');
  assert.deepEqual(frame.strikePoints.slice(0,5).map(point=>point.name), ['palm','pinky','middle','pointer','thumb']);
  assert.equal(new Set(frame.strikePoints.map(point => point.id)).size, 10);
});

test('partial hand exposes its remaining pinky for contact detection', () => {
  const input = ready();
  const partial = result();
  partial.landmarks = [partial.landmarks[0].map(() => ({ x: -2, y: -2, z: 0 }))];
  partial.landmarks[0][20] = { x: 0.21, y: 0.4, z: 0 };
  const frame = input.update(partial, 820);
  assert.equal(frame.hands.length, 1);
  assert.equal(frame.overlayPoints.length, 1);
  assert.equal(frame.strikePoints.length, 1);
  assert.equal(frame.strikePoints[0].id, 'hand-1:pinky');
});

test('ten seconds without a match times out; one matched hand resets the timer', () => {
  const input = ready();
  const empty = { landmarks: [], handedness: [], worldLandmarks: [] };
  assert.equal(input.update(empty, 10799).timedOut, false);
  assert.equal(input.update(empty, 10800).timedOut, true);
  input.reset(20000);
  assert.equal(input.update(empty, 29999).timedOut, false);
  assert.equal(input.update(empty, 30000).timedOut, true);
});

test('selected hand points reach the drum detector as one contact, not five hits', () => {
  const input = ready();
  const detector = new Detector();
  const zones = [{ id: 'snare', x: 0.8, y: 0.5, width: 0.12, height: 0.12 }];
  detector.update(input.update(result(), 820).strikePoints, zones, 820);
  const entering = result();
  entering.landmarks[0].forEach(point => { point.y = 0.46; });
  const hits = detector.update(input.update(entering, 870).strikePoints, zones, 870);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].drum, 'snare');
  assert.equal(hits[0].source, 'hand-1');
  assert.equal(detector.update(input.update(entering, 920).strikePoints, zones, 920).length, 0);
});
