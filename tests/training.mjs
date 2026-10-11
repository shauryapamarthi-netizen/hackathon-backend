import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreAttempt, rewardProgress} from '../dist/training-core.mjs';
const notes=[{drum:'snare',time:1},{drum:'hi-hat',time:2}];
test('accurate hits score and wrong or repeated hits reduce accuracy',()=>{
 assert.equal(scoreAttempt(notes,[{drum:'snare',time:1},{drum:'hi-hat',time:2}]).score,100);
 assert.equal(scoreAttempt(notes,[]).score,0);
 assert.equal(scoreAttempt(notes,[{drum:'crash',time:1},{drum:'crash',time:2}]).score,0);
 assert.ok(scoreAttempt(notes,[{drum:'snare',time:1},{drum:'snare',time:1.01},{drum:'hi-hat',time:2}]).score<100);
 assert.equal(scoreAttempt(notes,[{drum:'snare',time:1.4},{drum:'hi-hat',time:2.4}]).score,0);
});
test('rewards require passing; replay cannot farm diamonds; streak uses distinct consecutive dates',()=>{
 const fail=rewardProgress({},0,20,'2026-10-11');assert.equal(fail.progress.diamonds,0);
 const win=rewardProgress({},0,90,'2026-10-11');assert.equal(win.progress.streak,1);assert.equal(win.progress.diamonds,25);
 const repeat=rewardProgress(win.progress,0,90,'2026-10-11');assert.equal(repeat.earned,0);assert.equal(repeat.progress.streak,1);
 const next=rewardProgress(win.progress,1,80,'2026-10-12');assert.equal(next.progress.streak,2);
 const gap=rewardProgress(next.progress,2,80,'2026-10-15');assert.equal(gap.progress.streak,1);
});
test('passing with no improvement keeps XP unchanged and a new mastery score earns only the bonus',()=>{
 const first=rewardProgress({},0,70,'2026-10-11');
 const mastered=rewardProgress(first.progress,0,95,'2026-10-11');
 assert.equal(mastered.earned,5);assert.equal(mastered.xp,25);
 const repeated=rewardProgress(mastered.progress,0,65,'2026-10-11');
 assert.equal(repeated.xp,0);assert.equal(repeated.progress.best[0],95);
});
import {summarizeDrums, recommendPractice} from '../dist/training-core.mjs';
test('remembers weak drums and recommends repeating a struggling lesson',()=>{
 const stats=summarizeDrums([{drum:'snare',time:1},{drum:'hi-hat',time:2}],[{drum:'snare',time:1.04}]);
 assert.equal(stats['snare'].matched,1);assert.equal(stats['hi-hat'].missed,1);
 assert.deepEqual(recommendPractice([{lesson:2,score:40,drums:stats}]),{lesson:2,weakest:'hi-hat',repeat:true});
});
