export const lessons = [
 {title:'Meet the beat',host:'Rudi',kind:'snare',bpm:70,tip:'Play one snare on every click. Relax your hands and let each hit breathe.',pattern:['snare'],length:8},
 {title:'Keep it ticking',host:'Hattie',kind:'hi-hat',bpm:80,tip:'Keep the hi-hat steady. Small, controlled movements are all you need.',pattern:['hi-hat'],length:8},
 {title:'A conversation',host:'Rudi',kind:'snare',bpm:75,tip:'Alternate hi-hat and snare. Count one, two, three, four.',pattern:['hi-hat','snare'],length:12},
 {title:'Tom has a plan',host:'Tommy',kind:'mid-tom',bpm:80,tip:'Move from snare to tom, then give the crash a single clean accent.',pattern:['snare','snare','mid-tom','crash'],length:12},
 {title:'Find your groove',host:'Hattie',kind:'hi-hat',bpm:90,tip:'Keep the spaces even as you switch instruments.',pattern:['hi-hat','snare','hi-hat','mid-tom'],length:16},
 {title:'The first gig',host:'Tommy',kind:'mid-tom',bpm:90,tip:'Your final test: bring the whole kit together. Aim for accuracy, not extra hits.',pattern:['hi-hat','snare','mid-tom','crash'],length:16,test:true}
];

export function scoreAttempt(notes, hits) {
 const used=new Set();let points=0,matched=0,totalError=0;
 for(const hit of hits){
  let best=-1,distance=.201;
  notes.forEach((note,index)=>{const d=Math.abs(note.time-hit.time);if(!used.has(index)&&note.drum===hit.drum&&d<distance){best=index;distance=d;}});
  if(best>=0){used.add(best);matched++;totalError+=distance;points+=distance<=.08?1:Math.max(.3,1-(distance-.08)*4);}
 }
 return {score:Math.round(100*points/Math.max(notes.length,hits.length,1)),matched,total:notes.length,extra:hits.length-matched,meanError:matched?Math.round(totalError/matched*1000):null};
}

export function rewardProgress(saved,index,score,today) {
 const progress={diamonds:0,xp:0,streak:0,lastDay:null,best:{},...saved,best:{...saved.best}};
 if(score<60)return {progress,earned:0,xp:0};
 const old=progress.best[index]||0,first=old<60;
 const earned=first?20+(score>=90?5:0):(score>=90&&old<90?5:0);
 const xp=first?Math.round(score):Math.max(0,score-old);
 progress.best[index]=Math.max(score,old);progress.diamonds+=earned;progress.xp+=xp;
 if(progress.lastDay!==today){
  const days=progress.lastDay?(Date.parse(today)-Date.parse(progress.lastDay))/86400000:Infinity;
  progress.streak=days===1?progress.streak+1:1;progress.lastDay=today;
 }
 return {progress,earned,xp};
}

export function summarizeDrums(notes,hits) {
 const drums={};
 for(const drum of new Set(notes.map(n=>n.drum))){
  const expected=notes.filter(n=>n.drum===drum),actual=hits.filter(h=>h.drum===drum);
  const result=scoreAttempt(expected,actual);
  drums[drum]={expected:expected.length,matched:result.matched,missed:expected.length-result.matched,meanError:result.meanError};
 }
 return drums;
}

export function recommendPractice(history) {
 const last=history.at(-1);if(!last)return null;
 const totals={};
 for(const attempt of history.slice(-5))for(const [drum,stats] of Object.entries(attempt.drums||{})){
  const item=totals[drum]||{missed:0,expected:0};item.missed+=stats.missed;item.expected+=stats.expected;totals[drum]=item;
 }
 const weakest=Object.keys(totals).sort((a,b)=>totals[b].missed/totals[b].expected-totals[a].missed/totals[a].expected)[0]||null;
 return {lesson:last.score<80?last.lesson:Math.min(last.lesson+1,lessons.length-1),weakest,repeat:last.score<80};
}
