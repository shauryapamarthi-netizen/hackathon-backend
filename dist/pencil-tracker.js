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
      this.lock = new root.MarkerLock();
      this.candidates = [];
      this.mode = 'neon'; // neon | yellow
    }

    setMode(mode) {
      this.mode = mode === 'yellow' ? 'yellow' : 'neon';
      this.prev.clear();
      this.lock.reset();
      this.candidates = [];
    }

    reset() {
      this.prev.clear();
      this.lock.reset();
      this.candidates = [];
    }

    /** @returns {{id:string,x:number,y:number,confidence:number}[]} */
    detect(video) {
      if (!video?.videoWidth) return [];
      const cx = this.ctx;
      cx.drawImage(video, 0, 0, W, H);
      const { data } = cx.getImageData(0, 0, W, H);
      const raw = this.mode === 'yellow' ? this.#yellowTips(data) : this.#neonTips(data);
      this.candidates = raw;
      return this.lock.update(raw, performance.now());
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
        for (const tip of this.#blobs(mask, 8, 1800)) out.push({ id: name, n: tip.n, x: 1 - tip.cx / W, y: tip.cy / H, confidence: 1 });
      }
      return out;
    }

    #yellowTips(data) {
      const wood = new Uint8Array(W * H);
      for (let i = 0; i < wood.length; i++) {
        const o = i * 4;
        wood[i] = this.#isYellowWood(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
      }
      const shafts = this.#blobs(wood, 40, 9000);
      const tips = [];
      for (const shaft of shafts) {
        for (const tip of this.#shaftEnds(shaft)) {
          tips.push({id:'wood',n:shaft.n,x:1-tip.x/W,y:tip.y/H,confidence:.7});
        }
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
        const elongated = Math.max(height / width, width / height) >= 2.5;

        out.push({ n, cx: sx / n, cy: sy / n, tipX, tipY, minX, maxX, minY, maxY, pixels: q });
      }
      return out;
    }

    #shaftEnds(blob) {
      // Principal axis follows diagonal shafts as well as vertical/horizontal ones.
      let xx=0, yy=0, xy=0;
      for(const at of blob.pixels){const x=at%W-blob.cx,y=Math.floor(at/W)-blob.cy;xx+=x*x;yy+=y*y;xy+=x*y;}
      xx/=blob.n;yy/=blob.n;xy/=blob.n;
      const spread=Math.hypot(xx-yy,2*xy),major=(xx+yy+spread)/2,minor=(xx+yy-spread)/2;
      if(major<20 || major/Math.max(1,minor)<12) return [];
      const angle=.5*Math.atan2(2*xy,xx-yy),ux=Math.cos(angle),uy=Math.sin(angle);
      let lo=Infinity,hi=-Infinity;
      const projected=blob.pixels.map(at=>{const x=at%W,y=Math.floor(at/W),t=(x-blob.cx)*ux+(y-blob.cy)*uy;lo=Math.min(lo,t);hi=Math.max(hi,t);return{x,y,t};});
      // Average the terminal slice so a single jagged pixel cannot move the cursor.
      const band=Math.max(1,(hi-lo)*.04);
      return [lo,hi].map(end=>{const points=projected.filter(p=>Math.abs(p.t-end)<=band);return{x:points.reduce((a,p)=>a+p.x,0)/points.length,y:points.reduce((a,p)=>a+p.y,0)/points.length};});
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = PencilTracker;
  else root.PencilTracker = PencilTracker;
})(globalThis);
