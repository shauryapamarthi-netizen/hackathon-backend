const {test}=require('node:test'),assert=require('node:assert/strict');
Object.defineProperty(global,'performance',{value:{now:()=>100},configurable:true});
global.MarkerLock=require('../dist/marker-lock.js');
let pixels=new Uint8ClampedArray(480*270*4);
global.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData(){return {data:pixels}}})})};
const Pencil=require('../dist/pencil-tracker.js');
function rect(x,y,w,h,r,g,b){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const o=(j*480+i)*4;pixels.set([r,g,b,255],o)}}
test('neon image does not auto-lock; selection follows small tip beside larger distractor',()=>{pixels.fill(0);rect(100,100,8,8,255,0,180);rect(300,100,20,20,255,0,180);const p=new Pencil();assert.deepEqual(p.detect({videoWidth:480}),[]);const tip=p.candidates.find(c=>c.n===64);assert.ok(tip);p.lock.select('pink',tip,performance.now());assert.equal(p.detect({videoWidth:480})[0].n,64);pixels.fill(0);assert.deepEqual(p.detect({videoWidth:480}),[]);rect(100,100,8,8,255,0,180);assert.deepEqual(p.detect({videoWidth:480}),[])});
test('yellow candidates reject broad patches and retain explicitly selected shaft',()=>{pixels.fill(0);rect(90,70,8,60,220,180,40);rect(280,80,50,50,220,180,40);const p=new Pencil();p.setMode('yellow');assert.deepEqual(p.detect({videoWidth:480}),[]);assert.equal(p.candidates.length,1);p.lock.select('left',p.candidates[0],performance.now());assert.equal(p.detect({videoWidth:480})[0].id,'left');p.reset();assert.deepEqual(p.detect({videoWidth:480}),[])});
test('two yellow tracks cannot share one candidate',()=>{const l=new global.MarkerLock(),p={id:'wood',n:100,x:.4,y:.4};l.select('left',p,0);l.select('right',{...p,x:.42},0);assert.deepEqual(l.update([p],16),[])});
