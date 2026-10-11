export class HandSession {
  constructor() { this.reset(); }

  reset() {
    this.state = 'calibrating';
    this.since = null;
    this.previous = null;
    this.tracks = [];
    this.lastSeen = null;
  }

  update(hands, now) {
    if (this.state === 'lost') return this.output([], 'Hands lost. Press Set up hands to start again.');
    if (this.state === 'calibrating') {
      if (hands.length !== 2) {
        this.since = null;
        this.previous = null;
        return this.output([], 'Show only your two hands, separated and open.', hands);
      }
      const ordered = [...hands].sort((a, b) => a.landmarks[0].x - b.landmarks[0].x);
      const wrists = ordered.map(hand => hand.landmarks[0]);
      if (distance(wrists[0], wrists[1]) < 0.2) {
        this.since = null;
        return this.output([], 'Separate your hands a little more.', hands);
      }
      if (!this.previous || wrists.some((point, index) => distance(point, this.previous[index]) > 0.06)) this.since = now;
      this.previous = wrists;
      if (this.since === null) this.since = now;
      if (now - this.since < 750) return this.output([], 'Hold both hands still for a moment...', hands);
      this.tracks = ordered.map((hand, index) => ({ id: `hand-${index + 1}`, points: getHandPoints(hand.landmarks), vx: 0, vy: 0, lastSeen: now }));
      this.state = 'locked';
      this.lastSeen = now;
      return this.output(ordered.map((hand, index) => ({ ...hand, id: this.tracks[index].id })), 'Hands selected. Ready to move.');
    }
    if (now - this.lastSeen >= 10000) {
      this.state = 'lost';
      return this.output([], 'Hands lost. Press Set up hands to start again.');
    }
    if (hands.length === 0 || hands.length > 2) {
      this.state = 'recovering';
      return this.output([], 'Camera is still on. Bring your hands back into view.');
    }
    const matches = this.tracks.map(track => hands.map(hand => {
      const dt = Math.max(1, now - track.lastSeen);
      const horizon = dt > 150 ? 0 : Math.min(dt, 70);
      let best = { cost: Infinity };
      for (const point of getHandPoints(hand.landmarks)) {
        const previous = track.points.find(candidate => candidate.name === point.name);
        if (!previous) continue;
        const predicted = { x: previous.x + track.vx * horizon, y: previous.y + track.vy * horizon };
        const cost = Math.min(distance(predicted, point), distance(previous, point));
        if (cost <= (dt > 150 ? 0.3 : 0.18) && cost < best.cost) best = { cost, previous, point };
      }
      return best;
    }));
    const costs = matches.map(row => row.map(match => match.cost));
    const assignments = [];
    for (let first = -1; first < hands.length; first++) {
      for (let second = -1; second < hands.length; second++) {
        if (first >= 0 && first === second) continue;
        const indices = [first, second];
        const count = indices.filter(index => index >= 0).length;
        const cost = indices.reduce((total, index, track) => total + (index < 0 ? 0 : costs[track][index]), 0);
        if (count && Number.isFinite(cost)) assignments.push({ indices, count, cost });
      }
    }
    assignments.sort((a, b) => b.count - a.count || a.cost - b.cost);
    const best = assignments[0];
    const alternative = assignments[1];
    if (!best || (alternative?.count === best.count && alternative.cost - best.cost < 0.04)) {
      this.state = 'recovering';
      return this.output([], 'Match uncertain. Keep your hands separated.');
    }
    const selected = [];
    best.indices.forEach((handIndex, index) => {
      if (handIndex < 0) return;
      const hand = hands[handIndex];
      const track = this.tracks[index];
      const dt = Math.max(1, now - track.lastSeen);
      const { point, previous } = matches[index][handIndex];
      track.vx = dt > 150 ? 0 : Math.max(-0.006, Math.min(0.006, (point.x - previous.x) / dt));
      track.vy = dt > 150 ? 0 : Math.max(-0.006, Math.min(0.006, (point.y - previous.y) / dt));
      track.points = getHandPoints(hand.landmarks);
      track.lastSeen = now;
      selected.push({ ...hand, id: track.id });
    });
    this.lastSeen = now;
    this.state = selected.length === 2 ? 'locked' : 'recovering';
    return this.output(selected, selected.length === 2 ? 'Following your selected hands.' : 'One hand visible. Bring the other hand back into view.');
  }

  output(hands, message, previewHands = []) {
    return { state: this.state, hands, previewHands, message };
  }
}

function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export function getHandPoints(landmarks) {
  const base = [0, 5, 9, 13, 17].map(index => landmarks[index]);
  const points = [];
  if (base.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))) {
    points.push({ name: 'palm', x: base.reduce((sum, point) => sum + point.x, 0) / 5, y: base.reduce((sum, point) => sum + point.y, 0) / 5 });
  }
  for (const [name, index] of [['pinky', 20], ['middle', 12], ['pointer', 8], ['thumb', 4]]) {
    if (landmarks[index]) points.push({ ...landmarks[index], name });
  }
  return points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}
