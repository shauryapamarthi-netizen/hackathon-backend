(function(root) {
  class StrikeDetector {
    constructor() {
      this.tracks = new Map();
      this.contacts = new Map();
      this.radiusScale = 1.25;
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
          if (!near) contact.held = false;
          let velocity = 0;
          let firstSeenInside = false;
          for (const point of nodes) {
            const current = normalized(point);
            const inside = current.x * current.x + current.y * current.y <= 1;
            const previous = this.tracks.get(point.id);
            const dt = previous ? time - previous.time : Infinity;
            if (!previous || dt > 180 || dt <= 0) {
              firstSeenInside ||= inside;
              continue;
            }
            const before = normalized(previous);
            if (before.x * before.x + before.y * before.y <= 1) continue;
            const dx = current.x - before.x;
            const dy = current.y - before.y;
            const length = dx * dx + dy * dy;
            const t = length ? Math.max(0, Math.min(1, -(before.x * dx + before.y * dy) / length)) : 0;
            const x = before.x + t * dx;
            const y = before.y + t * dy;
            if (x * x + y * y <= 1) {
              const speed = Math.hypot(point.x - previous.x, point.y - previous.y) * 1000 / dt;
              velocity = Math.max(velocity, Math.min(1, Math.max(0.25, speed / 2)));
            }
          }
          if (!contact.held && velocity && time - contact.lastHit >= 75) {
            hits.push({ drum: zone.id, velocity, source: hand });
            contact.lastHit = time;
            contact.held = true;
          } else if (firstSeenInside) {
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
