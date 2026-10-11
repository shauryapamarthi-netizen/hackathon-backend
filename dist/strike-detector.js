/* Coordinates are normalized to the mirrored, uncropped camera image. */
(function(root){
 class StrikeDetector {
  constructor(){this.tracks=new Map();this.threshold=.35;}
  reset(){this.tracks.clear();}
  update(points,zones,time){
   const hits=[];const present=new Set();
   for(const p of points){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    present.add(p.id);let s=this.tracks.get(p.id);
    if(!s||time-s.time>180){s={...p,time,armed:new Set(),lastHit:-Infinity};this.tracks.set(p.id,s);}
    const dt=(time-s.time)/1000;
    for(const z of zones){
     const line=z.y-z.height*.15;
     if(p.y<line-.025)s.armed.add(z.id);
     if(dt<=0||dt>.18||time-s.lastHit<75||!s.armed.has(z.id))continue;
     const dy=p.y-s.y, speed=dy/dt;
     const alpha=dy>0?(line-s.y)/dy:-1;
     const x=s.x+(p.x-s.x)*alpha;
     if(speed>=this.threshold&&alpha>=0&&alpha<=1&&Math.abs(x-z.x)<=z.width*.5){
      hits.push({drum:z.id,velocity:Math.min(1,Math.max(.2,speed/2)),source:p.id});
      s.armed.clear();s.lastHit=time;break;
     }
    }
    s.x=p.x;s.y=p.y;s.time=time;
   }
   for(const [id] of this.tracks)if(!present.has(id))this.tracks.delete(id);
   return hits;
  }
 }
 if(typeof module!=='undefined')module.exports=StrikeDetector;else root.StrikeDetector=StrikeDetector;
})(globalThis);
