const {test}=require('node:test');
const assert=require('node:assert/strict');
const PencilDetector=require('../dist/pencil-strike-detector.js');
const HandDetector=require('../dist/strike-detector.js');
const zone={id:'snare',x:.5,y:.5,width:.2,height:.2};

test('pencil downward strokes retain the teammate line detector',()=>{
 const detector=new PencilDetector();
 detector.update([{id:'pink',x:.5,y:.3}],[zone],0);
 assert.equal(detector.update([{id:'pink',x:.5,y:.49}],[zone],50).length,1);
 assert.equal(detector.update([{id:'pink',x:.5,y:.49}],[zone],100).length,0);
 detector.update([{id:'pink',x:.5,y:.4}],[zone],150);
 assert.equal(detector.update([{id:'pink',x:.5,y:.49}],[zone],200).length,1);
});

test('hand nodes still require palm or three fingertips independently of pencils',()=>{
 const detector=new HandDetector();
 const finger=y=>({id:'h:pointer',name:'pointer',handId:'h',x:.5,y});
 detector.update([finger(.3)],[zone],0);
 assert.equal(detector.update([finger(.5)],[zone],50).length,0);
});
