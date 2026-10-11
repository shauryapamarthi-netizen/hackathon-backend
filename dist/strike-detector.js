(function(root) {
  class StrikeDetector {
    constructor() {
      this.tracks = new Map();
      this.contacts = new Map();
      this.radiusScale = 1;
      this.repeatDelayMs = 100;
    }

    reset() {
      this.tracks.clear();
      this.contacts.clear();
    }

    update(points, zones, time) {
      const hits = [];
      const present = new Set();
      const groups = new Map();
      for (const point of points) {
        if (present.has(point.id)) continue;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
        present.add(point.id);
        const hand = point.handId || point.id;
        if (!groups.has(hand)) groups.set(hand, []);
        groups.get(hand).push(point);
      }

      for (const [hand, nodes] of groups) {
        for (const zone of zones) {
          const rx = zone.width * this.radiusScale / 2;
          const ry = zone.height * this.radiusScale / 2;
          if (!(rx > 0) || !(ry > 0)) continue;
          const key = `${hand}/${zone.id}`;
          const contact = this.contacts.get(key) || { nodes: new Map(), lastHit: -Infinity, lastSeen: time };
          const normalized = point => ({ x: (point.x - zone.x) / rx, y: (point.y - zone.y) / ry });
          let velocity = 0;
          let crossing = false;
          const fingerIntervals = [];
          contact.lastSeen = time;
          for (const point of nodes) {
            const current = normalized(point);
            const inside = current.x * current.x + current.y * current.y <= 1;
            const previous = this.tracks.get(point.id);
            const dt = previous ? time - previous.time : Infinity;
            const near = current.x * current.x + current.y * current.y <= 1.12 ** 2;
            const held = contact.nodes.get(point.id) || false;
            contact.nodes.set(point.id, near && (held || inside));
            if (!previous || dt > (previous?.missing ? 80 : 180) || dt <= 0) continue;
            const before = normalized(previous);
            const dx = current.x - before.x;
            const dy = current.y - before.y;
            const a = dx * dx + dy * dy;
            const b = 2 * (before.x * dx + before.y * dy);
            const c = before.x * before.x + before.y * before.y - 1;
            let enter = 0, exit = 1;
            if (a < 1e-12) {
              if (c > 0) continue;
            } else {
              const discriminant = b * b - 4 * a * c;
              if (discriminant < 0) continue;
              const root = Math.sqrt(discriminant);
              enter = Math.max(0, (-b - root) / (2 * a));
              exit = Math.min(1, (-b + root) / (2 * a));
              if (enter > exit) continue;
            }
            const fromAbove = !held && c > 0 && dy > 0 && dy >= Math.abs(dx) * 0.5 && before.y + enter * dy <= -0.25;
            const name = point.name || point.id.split(':').pop();
            if (!point.handId || name === 'palm') {
              if (fromAbove) crossing = true;
            } else if (['pointer','middle','pinky','thumb'].includes(name)) {
              fingerIntervals.push({ time: previous.time + enter * dt, delta: 1, fresh: fromAbove ? 1 : 0 });
              fingerIntervals.push({ time: previous.time + exit * dt, delta: -1, fresh: fromAbove ? -1 : 0 });
            }
            const speed = Math.hypot(point.x - previous.x, point.y - previous.y) * 1000 / dt;
            velocity = Math.max(velocity, Math.min(1, Math.max(0.25, speed / 2)));
          }
          fingerIntervals.sort((a,b)=>a.time-b.time || b.delta-a.delta);
          let touching = 0, entering = 0;
          for (const event of fingerIntervals) {
            touching += event.delta;
            entering += event.fresh;
            if (touching >= 3 && entering > 0) crossing = true;
          }
          if (crossing && time - contact.lastHit >= this.repeatDelayMs) {
            hits.push({ drum: zone.id, velocity, source: hand });
            contact.lastHit = time;
          }
          this.contacts.set(key, contact);
        }
      }
      for (const nodes of groups.values()) {
        for (const point of nodes) this.tracks.set(point.id, { ...point, time });
      }
      for (const [id, point] of this.tracks) {
        if (!present.has(id)) point.missing = true;
        if (time - point.time > 80) this.tracks.delete(id);
      }
      for (const [key, contact] of this.contacts) {
        if (time - contact.lastSeen > Math.max(80, this.repeatDelayMs)) this.contacts.delete(key);
        else for (const id of contact.nodes.keys()) if (!this.tracks.has(id)) contact.nodes.delete(id);
      }
      return hits;
    }
  }
  if (typeof module !== 'undefined') module.exports = StrikeDetector;
  else root.StrikeDetector = StrikeDetector;
})(globalThis);
