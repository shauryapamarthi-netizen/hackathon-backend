/* Coordinates are normalized to the mirrored, uncropped camera image. */
(function (root) {
  class PencilStrikeDetector {
    constructor() {
      this.tracks = new Map();
      this.threshold = 0.28; // normalized units / second
      this.cooldownMs = 38; // allows rapid rolls / 16ths
      this.maxFrameGapMs = 140;
      this.lineBias = 0.15; // strike line = zone.y - height * lineBias
    }

    reset() {
      this.tracks.clear();
    }

    update(points, zones, time) {
      const hits = [];
      const present = new Set();

      for (const p of points) {
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
        present.add(p.id);

        let s = this.tracks.get(p.id);
        if (!s || time - s.time > this.maxFrameGapMs) {
          s = {
            x: p.x,
            y: p.y,
            time,
            armed: new Set(),
            lastHit: -Infinity,
            vy: 0,
          };
          this.tracks.set(p.id, s);
        }

        const dt = (time - s.time) / 1000;
        const vy = dt > 0 ? (p.y - s.y) / dt : p.vy || 0;
        s.vy = Number.isFinite(vy) ? vy : 0;

        for (const z of zones) {
          const rx=Math.max(0,p.rx||0),ry=Math.max(0,p.ry||0);
          const line = z.y - z.height * this.lineBias - ry;
          const half = z.width * 0.52;
          const nearX = Math.abs(p.x - z.x) <= half || Math.abs(s.x - z.x) <= half;

          // Lift above the line OR bounce (upward velocity) re-arms for rolls.
          if (p.y < line - 0.012) s.armed.add(z.id);
          else if (s.vy < -0.55 && nearX && time - s.lastHit > 18) s.armed.add(z.id);

          if (dt <= 0 || dt > 0.16 || time - s.lastHit < this.cooldownMs || !s.armed.has(z.id)) continue;

          const dy = p.y - s.y;
          if (dy <= 0) continue;

          const speed = dy / dt;
          if (speed < this.threshold) continue;

          // Interpolated line crossing between previous and current sample.
          const alpha = (line - s.y) / dy;
          const crossX = s.x + (p.x - s.x) * alpha;
          let crossed = alpha >= 0 && alpha <= 1 && Math.abs(crossX - z.x) <= half;

          if (!crossed && rx > 0 && ry > 0) {
            for (const edge of [z.x-half,z.x+half]) {
              const ax=(s.x-edge)/rx,ay=(s.y-line-ry)/ry,dx=(p.x-s.x)/rx,vy=dy/ry;
              const a=dx*dx+vy*vy,b=2*(ax*dx+ay*vy),c=ax*ax+ay*ay-1,disc=b*b-4*a*c;
              if(a>0&&disc>=0){const t=(-b-Math.sqrt(disc))/(2*a);if(t>=0&&t<=1)crossed=true;}
            }
          }
          // Predictive: tip is just above the line, accelerating downward hard.
          const predictive =
            s.y < line && p.y >= line - 0.02 && speed >= this.threshold * 1.35 && Math.abs(p.x - z.x) <= half;

          // Roll / bounce: tip never cleared the line, but rebounded then drove back into the pad.
          const roll =
            nearX &&
            p.y >= line &&
            p.y <= z.y + z.height * 0.4 &&
            s.y < p.y &&
            s.y <= line + 0.06;

          if (crossed || (!(rx || ry) && (predictive || roll))) {
            const velocity = Math.min(1, Math.max(0.18, speed / 2.1));
            hits.push({ drum: z.id, velocity, source: p.id });
            s.armed.delete(z.id);
            s.lastHit = time;
            break;
          }
        }

        s.x = p.x;
        s.y = p.y;
        s.time = time;
      }

      for (const [id, s] of this.tracks) {
        if (!present.has(id)) this.tracks.delete(id);
      }
      return hits;
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = PencilStrikeDetector;
  else root.PencilStrikeDetector = PencilStrikeDetector;
})(typeof globalThis !== 'undefined' ? globalThis : this);
