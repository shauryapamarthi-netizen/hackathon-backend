import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/hand-session.js', import.meta.url), 'utf8');
const { HandSession } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function hand(x, label = 'Left') {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));
  landmarks[9] = { x, y: 0.4, z: 0 };
  return { landmarks, handedness: label };
}

function enrolled() {
  const session = new HandSession();
  session.update([hand(0.2), hand(0.8, 'Right')], 0);
  for (let time = 100; time <= 800; time += 100) {
    session.update([hand(0.2), hand(0.8, 'Right')], time);
  }
  return session;
}

test('requires two steady hands before emitting selected hands', () => {
  const session = new HandSession();
  assert.equal(session.update([hand(0.2)], 0).hands.length, 0);
  assert.equal(session.update([hand(0.2), hand(0.8)], 100).state, 'calibrating');
  assert.equal(enrolled().update([hand(0.2), hand(0.8)], 820).state, 'locked');
});

test('keeps IDs when detector array order reverses', () => {
  const output = enrolled().update([hand(0.79, 'Right'), hand(0.21)], 820);
  assert.equal(output.hands[0].id, 'hand-1');
  assert.equal(output.hands[0].landmarks[0].x, 0.21);
  assert.equal(output.hands[1].id, 'hand-2');
});

test('rejects a distant replacement and requires deliberate reset after loss', () => {
  const session = enrolled();
  assert.equal(session.update([hand(0.2), hand(0.4, 'Right')], 820).hands.length, 1);
  assert.equal(session.update([], 10820).state, 'lost');
  assert.equal(session.update([hand(0.2), hand(0.8)], 11000).state, 'lost');
  session.reset();
  assert.equal(session.update([hand(0.2), hand(0.8)], 11100).state, 'calibrating');
});

test('does not enroll when additional hands are present', () => {
  const session = new HandSession();
  assert.equal(session.update([hand(0.2), hand(0.5), hand(0.8)], 0).state, 'calibrating');
  assert.equal(session.update([hand(0.2), hand(0.5), hand(0.8)], 2000).hands.length, 0);
});

test('follows quick continuous movement without position smoothing', () => {
  const session = enrolled();
  const frame = session.update([hand(0.28), hand(0.72, 'Right')], 820);
  assert.equal(frame.state, 'locked');
  assert.equal(frame.hands[0].landmarks[0].x, 0.28);
  assert.equal(session.update([hand(0.35), hand(0.65, 'Right')], 840).state, 'locked');
});

test('brief full loss automatically recovers the original session IDs', () => {
  const session = enrolled();
  assert.equal(session.update([], 1000).state, 'recovering');
  assert.equal(session.update([], 1400).hands.length, 0);
  const result = session.update([hand(0.23), hand(0.77, 'Right')], 1500);
  assert.equal(result.state, 'locked');
  assert.deepEqual(result.hands.map(hand => hand.id), ['hand-1', 'hand-2']);
});

test('one missing hand does not hide the other and returns under its original ID', () => {
  const session = enrolled();
  const partial = session.update([hand(0.79, 'Right')], 1100);
  assert.equal(partial.state, 'recovering');
  assert.deepEqual(partial.hands.map(hand => hand.id), ['hand-2']);
  const result = session.update([hand(0.22), hand(0.78, 'Right')], 1600);
  assert.equal(result.state, 'locked');
  assert.deepEqual(result.hands.map(hand => hand.id), ['hand-1', 'hand-2']);
});

test('one continuously visible hand keeps the session alive past ten seconds', () => {
  const session = enrolled();
  for (let time = 900; time <= 12000; time += 100) session.update([hand(0.2)], time);
  assert.equal(session.update([hand(0.2), hand(0.8)], 12100).state, 'locked');
});

test('recovers after nine seconds but expires at ten seconds with neither hand visible', () => {
  const session = enrolled();
  assert.equal(session.update([], 9799).state, 'recovering');
  assert.equal(session.update([hand(0.2), hand(0.8)], 9800).state, 'locked');
  assert.equal(session.update([], 19799).state, 'recovering');
  assert.equal(session.update([], 19800).state, 'lost');
});

test('any one of the four fingertip points can keep the selected hand tracked', () => {
  for (const index of [4, 8, 12, 20]) {
    const session = enrolled();
    const partial = hand(-2);
    partial.landmarks[9] = { x: -2, y: -2, z: 0 };
    partial.landmarks[index] = { x: 0.22, y: 0.5, z: 0 };
    const result = session.update([partial], 820);
    assert.deepEqual(result.hands.map(hand => hand.id), ['hand-1']);
    assert.equal(session.update([partial], 900).hands[0].id, 'hand-1');
  }
});

test('palm center alone can maintain tracking while fingertips are outside the frame', () => {
  const session = enrolled();
  const partial = hand(0.22);
  for (const index of [4, 8, 12, 20]) partial.landmarks[index].x = -2;
  assert.equal(session.update([partial], 820).hands[0]?.id, 'hand-1');
});

test('no selected points in frame produces no tracked hand', () => {
  const session = enrolled();
  const outside = hand(-2);
  assert.deepEqual(session.update([outside], 820).hands, []);
});

test('fast direction reversal keeps the hand selected', () => {
  const session = enrolled();
  assert.equal(session.update([hand(0.32), hand(0.8, 'Right')], 820).hands.length, 2);
  const result = session.update([hand(0.2), hand(0.8, 'Right')], 840);
  assert.deepEqual(result.hands.map(hand => hand.id), ['hand-1', 'hand-2']);
});
