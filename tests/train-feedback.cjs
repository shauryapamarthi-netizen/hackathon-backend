const {test}=require('node:test');
const assert=require('node:assert/strict');
const {trainingFeedback}=require('../lib/train-feedback');
test('reject invalid results before contacting a coach',async()=>{
 for(const body of [{score:101,matched:8,total:8},{score:50,matched:9,total:8},{score:'90',matched:8,total:8},null]){
  assert.equal((await trainingFeedback(body)).status,400);
 }
});
test('passes earlier feedback and timing progress into the coach',async()=>{
 let received;
 const result=await trainingFeedback({score:80,matched:6,total:8,lesson:0,meanError:60,history:[{score:50,matched:4,total:8,lesson:0,feedback:'Relax your hands.',meanError:120}]},async context=>{received=context;return 'Your timing improved. Keep your hands relaxed.';});
 assert.equal(received.improvement,30);
 assert.equal(received.history[0].feedback,'Relax your hands.');
 assert.equal(result.body.source,'ai');
});
