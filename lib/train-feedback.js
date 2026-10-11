const DRUMS=['snare','hi-hat','mid-tom','crash'];
function cleanAttempt(value) {
 if(!value||!Number.isFinite(value.score)||value.score<0||value.score>100||!Number.isInteger(value.matched)||!Number.isInteger(value.total)||value.total<1||value.total>64||value.matched<0||value.matched>value.total)return null;
 const drums={};
 for(const drum of DRUMS){
  const s=value.drums?.[drum];
  if(s&&Number.isInteger(s.expected)&&s.expected>0&&s.expected<=64&&Number.isInteger(s.missed)&&s.missed>=0&&s.missed<=s.expected)drums[drum]={expected:s.expected,missed:s.missed};
 }
 return {score:value.score,matched:value.matched,total:value.total,lesson:Number.isInteger(value.lesson)&&value.lesson>=0&&value.lesson<6?value.lesson:0,meanError:Number.isFinite(value.meanError)?Math.max(0,Math.min(1000,value.meanError)):null,drums,feedback:typeof value.feedback==='string'?value.feedback.slice(0,600):''};
}
async function configuredCoach(context) {
 if(!process.env.LUMINAL_API_KEY&&!process.env.ANTHROPIC_API_KEY)return null;
 return require('./claude').generateTrainingCoaching(context);
}
async function trainingFeedback(body,coach=configuredCoach) {
 const current=cleanAttempt(body);
 if(!current)return {status:400,body:{error:'Invalid lesson result.'}};
 const history=Array.isArray(body.history)?body.history.slice(-5).map(cleanAttempt).filter(Boolean):[];
 const previous=history.filter(a=>a.lesson===current.lesson).at(-1);
 const improvement=previous?current.score-previous.score:0;
 let fallback=current.score>=90?'Excellent control. Keep that relaxed motion as you move to a faster lesson.':current.score>=60?'You are building a steady groove. Repeat the lesson and aim for one clean hit on every click.':'Listen to the pattern again. Count out loud and focus on one drum hit per click.';
 if(previous)fallback=`Your score ${improvement>0?'rose by '+improvement:improvement<0?'fell by '+Math.abs(improvement):'held steady at '+current.score}${improvement?' points':''} since your last attempt at this lesson. `+fallback;
 const weakest=Object.keys(current.drums).sort((a,b)=>current.drums[b].missed/current.drums[b].expected-current.drums[a].missed/current.drums[a].expected)[0];
 if(weakest&&current.drums[weakest].missed)fallback+=` Focus on the ${weakest}: ${current.drums[weakest].missed} missed beats.`;
 try{
  const feedback=await coach({current,history,improvement});
  if(typeof feedback==='string'&&feedback.trim())return {status:200,body:{feedback:feedback.slice(0,1500),source:'ai'}};
 }catch{}
 return {status:200,body:{feedback:fallback,source:'practice'}};
}
module.exports={trainingFeedback};
