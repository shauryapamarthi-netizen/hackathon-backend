const {test}=require('node:test'),assert=require('node:assert/strict'),Detector=require('../dist/pencil-strike-detector.js');
const zone={id:'snare',x:.5,y:.6,width:.3,height:.2};
// Previous strike-detector tests retired with the removed tracking implementation.

test('circular tip hits with its radius before its center crosses',()=>{const d=new Detector();d.update([{id:'L',x:.5,y:.4,rx:.03,ry:.04}],[zone],0);assert.equal(d.update([{id:'L',x:.5,y:.55,rx:.03,ry:.04}],[zone],50).length,1)});
test('missing frame clears strike history',()=>{const d=new Detector();d.update([{id:'L',x:.5,y:.4}],[zone],0);d.update([],[zone],16);assert.equal(d.update([{id:'L',x:.5,y:.65}],[zone],32).length,0)});
test('circular edge reaches endpoint but distant circle misses',()=>{for(const [x,expected] of [[.67,1],[.70,0]]){const d=new Detector();d.update([{id:'L',x,y:.4,rx:.03,ry:.04}],[zone],0);assert.equal(d.update([{id:'L',x,y:.6,rx:.03,ry:.04}],[zone],50).length,expected)}});
