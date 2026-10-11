// Explicit selection prevents a background object becoming a new stick automatically.
(function(root){
class MarkerLock {
 constructor(){this.reset()}
 reset(){this.tracks=new Map()}
 select(id,p,time){this.tracks.set(id,{...p,time})}
 update(candidates,time){const out=[], used=new Map();for(const [id,last] of this.tracks){
  const dt=time-last.time;if(dt>180){this.tracks.delete(id);continue}
  const nearby=candidates.filter(p=>p.id===last.id&&p.n/last.n>.45&&p.n/last.n<2.2&&Math.hypot(p.x-last.x,p.y-last.y)<Math.min(.18,.035+dt*.0015)).sort((a,b)=>Math.hypot(a.x-last.x,a.y-last.y)-Math.hypot(b.x-last.x,b.y-last.y));
  if(!nearby.length||nearby.length>1&&Math.hypot(nearby[1].x-last.x,nearby[1].y-last.y)-Math.hypot(nearby[0].x-last.x,nearby[0].y-last.y)<.025){this.tracks.delete(id);continue}
  const p=nearby[0];if(used.has(p)){const other=used.get(p);this.tracks.delete(other);this.tracks.delete(id);const at=out.findIndex(v=>v.id===other);if(at>=0)out.splice(at,1);continue;}used.set(p,id);this.tracks.set(id,{...p,time});out.push({...p,id});
 }return out}
}
if(typeof module!=='undefined')module.exports=MarkerLock;else root.MarkerLock=MarkerLock;
})(globalThis);
