const {test}=require('node:test'),assert=require('node:assert/strict'),Lock=require('../dist/marker-lock.js');
const p={id:'pink',n:30,x:.3,y:.3};
test('background blobs never auto-acquire',()=>{assert.deepEqual(new Lock().update([p],0),[])});
test('selected tip is preferred over larger background blob',()=>{const l=new Lock();l.select('pink',p,0);assert.equal(l.update([{...p,x:.31},{...p,n:300,x:.8}],16)[0].x,.31)});
test('lost and ambiguous tips require selection again',()=>{const l=new Lock();l.select('pink',p,0);assert.deepEqual(l.update([],16),[]);assert.deepEqual(l.update([p],32),[]);l.select('pink',p,40);assert.deepEqual(l.update([{...p,x:.31},{...p,x:.32}],56),[])});
test('large jumps cannot turn background into a stick',()=>{const l=new Lock();l.select('pink',p,0);assert.deepEqual(l.update([{...p,x:.9}],16),[])});
