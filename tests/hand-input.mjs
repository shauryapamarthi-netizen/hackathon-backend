import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('setup cannot strike; selected hands render five points and strike once per hand', () => {
  const input = new HandInput(new HandSession(), getHandPoints);
  input.reset(0);
  assert.deepEqual(input.update(result(), 0).strikePoints, []);
  const frame = ready().update(result(), 820);
  assert.equal(frame.overlayPoints.length, 10);
  assert.equal(frame.strikePoints.length, 2);
  assert.equal(frame.strikePoints[0].x, 0.8);
  assert.equal(frame.strikePoints[0].id, 'hand-1');
});

test('partial hand stays selected without synthesizing an absent pointer strike', () => {
  const input = ready();
  const partial = result();
  partial.landmarks = [partial.landmarks[0].map(() => ({ x: -2, y: -2, z: 0 }))];
  partial.landmarks[0][20] = { x: 0.21, y: 0.4, z: 0 };
  const frame = input.update(partial, 820);
  assert.equal(frame.hands.length, 1);
  assert.equal(frame.overlayPoints.length, 1);
  assert.deepEqual(frame.strikePoints, []);
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
