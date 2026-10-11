(function(root) {
  class StrikeDetector {
    constructor() {
      this.tracks = new Map();
      this.contacts = new Map();
      this.radiusScale = 1;
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
      const activeContacts = new Set();
      for (const [hand, nodes] of groups) {
        for (const zone of zones) {
          const rx = zone.width * this.radiusScale / 2;
          const ry = zone.height * this.radiusScale / 2;
          if (!(rx > 0) || !(ry > 0)) continue;
          const key = `${hand}/${zone.id}`;
          activeContacts.add(key);
          const contact = this.contacts.get(key) || { held: false, lastHit: -Infinity };
          const normalized = point => ({ x: (point.x - zone.x) / rx, y: (point.y - zone.y) / ry });
          const near = nodes.some(point => {
            const q = normalized(point);
            return q.x * q.x + q.y * q.y <= 1.12 ** 2;
          });
          const wasHeld = contact.held;
          if (!near) contact.held = false;
          let velocity = 0;
          let firstSeenInside = 0;
          const intervals = [];
          const required = 1;
          for (const point of nodes) {
            const current = normalized(point);
            const inside = current.x * current.x + current.y * current.y <= 1;
            const previous = this.tracks.get(point.id);
            const dt = previous ? time - previous.time : Infinity;
            if (!previous || dt > 180 || dt <= 0) {
              if (inside) firstSeenInside++;
              continue;
            }
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
            intervals.push([previous.time + enter * dt, 1], [previous.time + exit * dt, -1]);
            const speed = Math.hypot(point.x - previous.x, point.y - previous.y) * 1000 / dt;
            velocity = Math.max(velocity, Math.min(1, Math.max(0.25, speed / 2)));
          }
          intervals.sort((a,b) => a[0] - b[0] || b[1] - a[1]);
          let count = 0, maximum = 0;
          for (const [, change] of intervals) { count += change; maximum = Math.max(maximum, count); }
          if (!wasHeld && !contact.held && maximum >= required && time - contact.lastHit >= 75) {
            hits.push({ drum: zone.id, velocity, source: hand });
            contact.lastHit = time;
            contact.held = near;
          } else if (firstSeenInside >= required) {
            contact.held = true;
          }
          this.contacts.set(key, contact);
        }
      }
      for (const nodes of groups.values()) {
        for (const point of nodes) this.tracks.set(point.id, { ...point, time });
      }
      for (const id of this.tracks.keys()) if (!present.has(id)) this.tracks.delete(id);
      for (const key of this.contacts.keys()) if (!activeContacts.has(key)) this.contacts.delete(key);
      return hits;
    }
  }
  if (typeof module !== 'undefined') module.exports = StrikeDetector;
  else root.StrikeDetector = StrikeDetector;
})(globalThis);
