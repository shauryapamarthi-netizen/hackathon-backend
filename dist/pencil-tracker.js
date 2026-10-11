/* Browser pencil-tip tracker. Coordinates: mirrored, normalized to the uncropped camera image. */
(function (root) {
  const W = 480;
  const H = 270;

  class PencilTracker {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.width = W;
      this.canvas.height = H;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.prev = new Map();
      this.mode = 'neon'; // neon | yellow
    }

    setMode(mode) {
      this.mode = mode === 'yellow' ? 'yellow' : 'neon';
      this.prev.clear();
    }

    reset() {
      this.prev.clear();
    }

    /** @returns {{id:string,x:number,y:number,confidence:number}[]} */
    detect(video) {
      if (!video?.videoWidth) return [];
      const cx = this.ctx;
      cx.drawImage(video, 0, 0, W, H);
      const { data } = cx.getImageData(0, 0, W, H);
      const raw = this.mode === 'yellow' ? this.#yellowTips(data) : this.#neonTips(data);
      return this.#stabilize(raw);
    }

    #neonTips(data) {
      const out = [];
      for (const name of ['pink', 'cyan']) {
        const mask = new Uint8Array(W * H);
        for (let i = 0; i < mask.length; i++) {
          const o = i * 4;
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          const hit = name === 'pink' ? this.#isPink(r, g, b) : this.#isCyan(r, g, b);
          mask[i] = hit ? 1 : 0;
        }
        const tip = this.#bestTipBlob(mask, 8, 4200);
        if (tip) out.push({ id: name, x: 1 - tip.x / W, y: tip.y / H, confidence: tip.confidence });
      }
      return out;
    }

    #yellowTips(data) {
      const wood = new Uint8Array(W * H);
      for (let i = 0; i < wood.length; i++) {
        const o = i * 4;
        wood[i] = this.#isYellowWood(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
      }
      const shafts = this.#blobs(wood, 40, 9000).sort((a, b) => b.n - a.n).slice(0, 2);
      const tips = [];
      for (let i = 0; i < shafts.length; i++) {
        const tip = this.#shaftTip(shafts[i], data);
        if (tip) tips.push({ id: i === 0 ? 'left' : 'right', x: 1 - tip.x / W, y: tip.y / H, confidence: tip.confidence });
      }
      return tips;
    }

    #isPink(r, g, b) {
      // Magenta / hot-pink tip tape or neon highlighter.
      return r > 120 && b > 80 && r > g * 1.35 && b > g * 1.15 && r + b > g * 2.2;
    }

    #isCyan(r, g, b) {
      return g > 95 && b > 95 && g > r * 1.25 && b > r * 1.25 && g + b > r * 2.3;
    }

    #isYellowWood(r, g, b) {
      // Classic yellow/orange pencil paint under common webcam white balance.
      return r > 145 && g > 105 && b < 125 && r > b * 1.35 && g > b * 1.05 && Math.abs(r - g) < 95;
    }

    #bestTipBlob(mask, minN, maxN) {
      let best = null;
      for (const blob of this.#blobs(mask, minN, maxN)) {
        if (!best || blob.n > best.n) best = blob;
      }
      if (!best) return null;
      // Tip = bottommost extremity (striking end), not the blob centroid.
      return {
        x: best.tipX,
        y: best.tipY,
        confidence: Math.min(1, best.n / 120),
      };
    }

    #blobs(mask, minN, maxN) {
      const out = [];
      const seen = mask; // mutate in place
      for (let i = 0; i < seen.length; i++) {
        if (!seen[i]) continue;
        const q = [i];
        seen[i] = 0;
        let n = 0;
        let sx = 0;
        let sy = 0;
        let tipX = 0;
        let tipY = -1;
        let minX = W;
        let maxX = 0;
        let minY = H;
        let maxY = 0;
        for (let k = 0; k < q.length; k++) {
          const at = q[k];
          const x = at % W;
          const y = (at / W) | 0;
          n++;
          sx += x;
          sy += y;
          if (y > tipY || (y === tipY && x < tipX)) {
            tipX = x;
            tipY = y;
          }
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const neighbors = [x > 0 ? at - 1 : -1, x < W - 1 ? at + 1 : -1, y > 0 ? at - W : -1, y < H - 1 ? at + W : -1];
          for (const next of neighbors) {
            if (next >= 0 && seen[next]) {
              seen[next] = 0;
              q.push(next);
            }
          }
        }
        if (n < minN || n > maxN) continue;
        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        // Prefer stick-like shapes over floor blobs / clothing patches.
        const elongated = height / Math.max(1, width) >= 0.55 || width / Math.max(1, height) >= 1.4 || n < 220;
        if (!elongated && n > 900) continue;
        out.push({ n, cx: sx / n, cy: sy / n, tipX, tipY, minX, maxX, minY, maxY, pixels: q });
      }
      return out;
    }

    #shaftTip(blob, data) {
      // Walk the major axis of the yellow shaft and pick the darker / lower end as the tip.
      const pts = blob.pixels;
      let bestDark = null;
      let bestDarkScore = Infinity;
      let lowest = null;
      for (const at of pts) {
        const x = at % W;
        const y = (at / W) | 0;
        // Sample a small neighborhood just beyond the wood for graphite / tip.
        for (const [dx, dy] of [[0, 2], [0, 3], [0, 4], [-1, 3], [1, 3]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const o = (ny * W + nx) * 4;
          const r = data[o];
          const g = data[o + 1];
          const b = data[o + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const chroma = Math.max(r, g, b) - Math.min(r, g, b);
          // Graphite tip: dark + low chroma. Also allow pink eraser tips.
          const eraser = r > 150 && g > 90 && b > 90 && r > g && Math.abs(g - b) < 40;
          if (lum < 85 && chroma < 45) {
            const score = lum - ny * 0.15;
            if (score < bestDarkScore) {
              bestDarkScore = score;
              bestDark = { x: nx, y: ny, confidence: Math.min(1, (90 - lum) / 70) };
            }
          } else if (eraser) {
            const score = 40 - ny * 0.15;
            if (score < bestDarkScore) {
              bestDarkScore = score;
              bestDark = { x: nx, y: ny, confidence: 0.7 };
            }
          }
        }
        if (!lowest || y > lowest.y) lowest = { x, y, confidence: 0.45 };
      }
      return bestDark || lowest;
    }

    #stabilize(points) {
      const now = performance.now();
      const matched = [];
      const used = new Set();
      for (const p of points) {
        let prev = this.prev.get(p.id);
        if (!prev) {
          // Steal nearest previous tip of any id within a short distance (id swap safety).
          let nearest = null;
          let nearestD = 0.08;
          for (const [id, s] of this.prev) {
            if (used.has(id)) continue;
            const d = Math.hypot(p.x - s.x, p.y - s.y);
            if (d < nearestD) {
              nearestD = d;
              nearest = s;
            }
          }
          prev = nearest;
        }
        let x = p.x;
        let y = p.y;
        if (prev && now - prev.t < 120) {
          const speed = Math.hypot(p.x - prev.x, p.y - prev.y);
          // Fast strokes stay snappy; slow motion gets light smoothing.
          const a = speed > 0.045 ? 0.85 : 0.55;
          x = prev.x + (p.x - prev.x) * a;
          y = prev.y + (p.y - prev.y) * a;
        }
        const vx = prev ? (x - prev.x) / Math.max(0.001, (now - prev.t) / 1000) : 0;
        const vy = prev ? (y - prev.y) / Math.max(0.001, (now - prev.t) / 1000) : 0;
        matched.push({ id: p.id, x, y, confidence: p.confidence, vx, vy });
        used.add(p.id);
        this.prev.set(p.id, { x, y, t: now, vx, vy });
      }
      for (const [id, s] of this.prev) {
        if (now - s.t > 220) this.prev.delete(id);
      }
      return matched;
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = PencilTracker;
  else root.PencilTracker = PencilTracker;
})(globalThis);
