import './studio-layout.js';
import {lessons,scoreAttempt,rewardProgress,summarizeDrums,recommendPractice} from './training-core.mjs';

const $=id=>document.getElementById(id);
const workspace=document.querySelector('.workspace');
const nav=document.querySelector('.modes');
workspace.before(nav);
nav.classList.add('studio-navigation');
const trainButton=document.createElement('button');
trainButton.id='train';trainButton.textContent='✦  Train';trainButton.setAttribute('aria-pressed','false');nav.append(trainButton);
const root=document.createElement('section');root.id='trainView';root.hidden=true;workspace.before(root);
const names={'snare':'Snare','hi-hat':'Hi-hat','mid-tom':'Tom',crash:'Crash'};
const cameraPanel=document.querySelector('.camera-panel');
const cameraHome=document.createComment('camera home');cameraPanel.before(cameraHome);
const lessonControls=['soundOn','trackToggle','setupHands','trackingStatus'].map(id=>{const node=$(id),home=document.createComment(id+' home');node.before(home);return {node,home};});
let setupTimer=null;
let handSeen=0,handState='idle',history=[];
try{const saved=JSON.parse(localStorage.getItem('air-drum-coach-memory-v1'));if(Array.isArray(saved))history=saved.filter(a=>Number.isInteger(a.lesson)&&lessons[a.lesson]&&Number.isFinite(a.score)).slice(-50);}catch{}
window.addEventListener('hands-detected',event=>{handState=event.detail.state;if(event.detail.hands?.length)handSeen=performance.now();});
function saveMemory(){try{localStorage.setItem('air-drum-coach-memory-v1',JSON.stringify(history));return true;}catch{return false;}}
function cameraReady(){const state=window.airDrumStudio.getTrackingState();return state.running&&state.input==='hands'&&$('video').srcObject&&performance.now()-handSeen<1200&&handState==='locked';}
const keys={'snare':'S','hi-hat':'A','mid-tom':'D',crash:'F'};
let progress={best:{},diamonds:0,xp:0,streak:0},selected=0,active=null,timer=null,training=false,showCamera=false,request=null;
try{const saved=JSON.parse(localStorage.getItem('air-drum-training-v1'));if(saved&&typeof saved.best==='object'&&Number.isFinite(saved.diamonds)&&Number.isFinite(saved.xp))progress=saved;}catch{}

function mascot(kind,size=100){
 const color=kind==='snare'?'#8c78ed':kind==='hi-hat'?'#ffcc59':'#45c8b4';
 return `<svg class="drum-friend" width="${size}" height="${size}" viewBox="0 0 120 120" role="img" aria-label="Friendly ${names[kind]} character"><path d="M30 85 21 107m65-22 13 22" stroke="#233955" stroke-width="7" stroke-linecap="round"/><path d="M21 60 10 48m89 12 11-12" stroke="${color}" stroke-width="8" stroke-linecap="round"/><rect x="24" y="33" width="72" height="59" rx="19" fill="${color}" stroke="#233955" stroke-width="3"/><ellipse cx="60" cy="35" rx="37" ry="13" fill="#fff6df" stroke="#233955" stroke-width="3"/><path d="m39 20-6-12m47 12 7-12" stroke="#233955" stroke-width="5" stroke-linecap="round"/><ellipse cx="45" cy="60" rx="4" ry="6" fill="#233955"/><ellipse cx="75" cy="60" rx="4" ry="6" fill="#233955"/><path d="M49 74q11 12 22 0" fill="none" stroke="#233955" stroke-width="3" stroke-linecap="round"/><circle cx="35" cy="71" r="5" fill="#fff" opacity=".4"/><circle cx="85" cy="71" r="5" fill="#fff" opacity=".4"/></svg>`;
}

function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function streak(){return progress.lastDay&&(Date.parse(today())-Date.parse(progress.lastDay))/86400000<=1?progress.streak:0;}
function unlocked(index){return index===0||(progress.best[index-1]||0)>=60;}
function render(){
 delete root.dataset.attempt;
 const done=lessons.filter((_,i)=>(progress.best[i]||0)>=60).length;
 root.innerHTML=`<div class="train-top"><div><span class="train-eyebrow">THE GROOVE CLUB</span><h2>A little rhythm. Every day.</h2><p>Meet your band. Find your beat. Build your streak.</p></div><div class="train-wallet"><span title="Consecutive practice days">🔥 <b>${streak()}</b> day streak</span><span>◆ <b>${progress.diamonds}</b> diamonds</span><span>✦ <b>${progress.xp}</b> XP</span></div></div><div class="train-grid"><div class="lesson-world"><div class="unit-banner"><div><small>UNIT 01 · BEGINNER</small><h3>Your first gig</h3></div><strong>${done} / ${lessons.length}</strong></div><div class="lesson-path">${lessons.map((lesson,i)=>`<div class="path-stop stop-${i%3}"><button class="lesson-node ${(progress.best[i]||0)>=60?'complete':''} ${i===selected?'current':''}" data-lesson="${i}" ${unlocked(i)?'':'disabled'} aria-label="${lesson.title}${unlocked(i)?'':', locked'}">${!unlocked(i)?'🔒':lesson.test?'★':(progress.best[i]||0)>=60?'✓':i+1}</button><div><b>${lesson.title}</b><small>${lesson.test?'FINAL TEST':`${lesson.bpm} BPM · ${lesson.length} beats`}${progress.best[i]?' · Best '+progress.best[i]+'%':''}</small></div>${[0,2,4].includes(i)?mascot(lesson.kind,72):''}</div>`).join('')}</div><div class="path-finish">★ &nbsp; Finish the test. Join the band.</div></div><div class="lesson-detail" id="lessonDetail"></div></div><p class="train-local">Progress and coach memory save in this browser. Earn diamonds on first passes and new 90% milestones.</p>`;
 root.querySelectorAll('[data-lesson]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.lesson);render();});
 detail();
}
function detail(){
 const l=lessons[selected];
 $('lessonDetail').innerHTML=`${mascot(l.kind,140)}<span class="train-eyebrow">${l.host.toUpperCase()}'S ${l.test?'CHALLENGE':'LESSON'}</span><h3>${l.title}</h3><p>${l.tip}</p><div class="lesson-pattern">${l.pattern.map(d=>`<span>${names[d]}</span>`).join('')}</div><p class="lesson-goal">Get 60% to pass. Get 90% for a bonus.<br>First pass: 20 diamonds + up to 100 XP.</p><button class="train-primary" id="startLesson">${progress.best[selected]?'Practice again':'Start lesson'} →</button><button class="train-secondary" id="listenLesson">♫ Hear the pattern</button><button class="train-secondary" id="trainCamera">${showCamera?'Hide':'Set up'} camera controls</button><p id="lessonNotice" role="status">Enable the camera and start hand tracking. Hold both hands open until selected, then start your lesson.</p><div class="train-flair">${streak()>=3?'🔥 On fire':progress.xp>=300?'★ Groove maker':progress.xp>0?'✦ Rising drummer':'✧ New band member'}</div>`;
 const recommendation=recommendPractice(history);
 const memory=document.createElement('div');memory.className='coach-memory';
 const title=document.createElement('strong');title.textContent='Your coach remembers';memory.append(title);
 const copy=document.createElement('p');copy.textContent=history.length?`${history.length} saved attempts. ${recommendation.repeat?'Repeat':'Try'} ${lessons[recommendation.lesson].title}.${recommendation.weakest?' Focus: '+names[recommendation.weakest]+'.':''}`:'Your practice history and feedback will appear here after your first camera lesson.';memory.append(copy);
 const previous=document.createElement('p');previous.textContent=history.at(-1)?.feedback||'';memory.append(previous);
 if(recommendation){const go=document.createElement('button');go.className='train-secondary';go.textContent='Practice my recommendation';go.onclick=()=>{selected=unlocked(recommendation.lesson)?recommendation.lesson:selected;render();};memory.append(go);}
 const forget=document.createElement('button');forget.className='train-secondary';forget.textContent='Clear coach memory';forget.onclick=()=>{history=[];saveMemory();detail();};memory.append(forget);
 $('lessonDetail').append(memory);
 $('startLesson').onclick=prepareLesson;
 $('trainCamera').textContent='Open camera lesson';
 $('trainCamera').onclick=prepareLesson;
 $('listenLesson').onclick=async()=>{
  if(active)return;
  try{await window.drumAudio.init();const a=window.drumAudio; l.pattern.forEach((d,i)=>a.play(d,.8,a.context.currentTime+.1+i*60/l.bpm));$('lessonNotice').textContent='Listen to the pattern, then try it yourself.';}catch{$('lessonNotice').textContent='Audio could not start. Check your browser sound settings.';}
 };
}
function cancel(){$('cameraBeatCue')?.remove();clearInterval(setupTimer);setupTimer=null;lessonControls.forEach(({node,home})=>home.after(node));clearInterval(timer);timer=null;active=null;window.airDrumStudio.trainingCameraOnly=false;cameraHome.after(cameraPanel);document.querySelectorAll('.training-target').forEach(e=>e.classList.remove('training-target'));}
function progressBar(total){
 return `<div class="lesson-progress"><div class="lesson-progress-label"><span>Lesson progress</span><strong id="lessonProgressText">0 / ${total} beats · 0%</strong></div><progress id="lessonProgress" max="${total}" value="0" aria-label="Lesson progress"></progress></div>`;
}
function prepareLesson(){
 cancel();workspace.hidden=true;
 if($('inputMode').value!=='hands'){$('inputMode').value='hands';$('inputMode').dispatchEvent(new Event('change'));}
 const l=lessons[selected];
 root.innerHTML=`<div class="train-session camera-lesson-setup"><div class="session-heading"><div><span class="train-eyebrow">CAMERA LESSON · ${l.bpm} BPM</span><h2>${l.title}</h2></div><button id="lessonBack" class="train-secondary">Back to lessons</button></div>${progressBar(l.length)}<p>${l.tip}</p><div class="lesson-camera-layout"><div id="lessonCamera"></div><div class="lesson-camera-controls"><h3>Get your hands ready</h3><ol><li>Enable your camera and allow access.</li><li>Start hand tracking and show both open hands.</li><li>Strike the highlighted drum with your hands.</li></ol><div id="lessonTrackingControls"></div><p id="lessonNotice" role="status"></p><button id="startLesson" class="train-primary" disabled>Waiting for your hands</button></div></div></div>`;
 $('lessonCamera').append(cameraPanel);
 lessonControls.forEach(({node})=>$('lessonTrackingControls').append(node));
 $('lessonBack').onclick=()=>{cancel();render();};
 $('startLesson').onclick=start;
 const update=()=>{const ready=cameraReady();$('startLesson').disabled=!ready;$('startLesson').textContent=ready?'Begin camera lesson →':'Waiting for your hands';$('lessonNotice').textContent=ready?'Hands selected. The countdown starts when you are ready.':'Your live camera kit appears here. Enable the camera, then start hand tracking.';};
 update();setupTimer=setInterval(update,150);
 root.scrollIntoView({block:'start'});
}
async function start(){
 if(active||!training)return;
 if(!cameraReady()){prepareLesson();return;}
 delete root.dataset.attempt;
 const l=lessons[selected];
 $('startLesson').disabled=true;
 try{await window.drumAudio.init();}catch{$('lessonNotice').textContent='Audio could not start. Please try again.';$('startLesson').disabled=false;return;}
 if(!training||!cameraReady()){$('startLesson').disabled=false;return;}
 if($('metro').textContent==='Stop metronome')$('metro').click();
 clearInterval(setupTimer);setupTimer=null;
 cameraHome.after(cameraPanel);lessonControls.forEach(({node,home})=>home.after(node));
 const period=60/l.bpm,origin=window.drumAudio.context.currentTime+.3;
 window.airDrumStudio.trainingCameraOnly=true;workspace.hidden=true;
 active={lesson:selected,origin,period,notes:Array.from({length:l.length},(_,i)=>({drum:l.pattern[i%l.pattern.length],time:origin+(i+4)*period})),hits:[],scheduled:0,lastBeat:-99};
 root.innerHTML=`<div class="train-session"><div class="session-heading"><div><span class="train-eyebrow">${l.host.toUpperCase()} · ${l.bpm} BPM</span><h2>${l.title}</h2></div><button id="exitLesson" class="train-secondary">End lesson</button></div>${progressBar(l.length)}<div class="beat-prompt">${mascot(l.kind,95)}<div><small id="beatLabel">GET READY</small><strong id="beatCue" role="status">4</strong></div></div><p>Hit the named drum on the click. Each beat accepts one hit.</p><div id="lessonCamera"></div><div id="trainReaction" role="status">Four clicks to count you in.</div><p class="train-next" id="trainNext"></p></div>`;
 $('exitLesson').onclick=prepareLesson;
 $('lessonCamera').append(cameraPanel);
 const cue=document.createElement('div');cue.id='cameraBeatCue';
 cue.innerHTML='<div class="camera-beat-top"><span id="cameraBeatNumber">COUNT IN</span><strong id="cameraBeatAction">Get ready</strong><span id="cameraBeatNext"></span></div><div class="beat-countdown"><div id="beatCountdownFill"></div></div><div id="cameraBeatQueue" class="camera-beat-queue"></div>';
 $('stage').append(cue);
 root.tabIndex=-1;root.focus({preventScroll:true});root.scrollIntoView({block:'start'});
 timer=setInterval(tick,20);tick();
}
function tick(){
 if(!active)return;
 if(!window.airDrumStudio.getTrackingState().running||!$('video').srcObject||performance.now()-handSeen>2000){prepareLesson();$('lessonNotice').textContent='Tracking was lost. Get both hands back in view and restart. This attempt was not scored.';return;}
 const a=active,now=window.drumAudio.context.currentTime,l=lessons[a.lesson];
 while(a.scheduled<l.length+4&&a.origin+a.scheduled*a.period<now+.12){window.drumAudio.tick(a.origin+a.scheduled*a.period,a.scheduled%4===0);a.scheduled++;}
 const completed=a.notes.filter(note=>now>=note.time+.2).length;
 if($('lessonProgress').value!==completed){$('lessonProgress').value=completed;$('lessonProgressText').textContent=`${completed} / ${l.length} beats · ${Math.round(completed/l.length*100)}%`;}
 const beat=Math.floor((now-a.origin)/a.period);
 const nextTime=a.notes.find(note=>note.time>now)?.time;
 $('beatCountdownFill').style.width=nextTime===undefined?'0%':Math.max(0,Math.min(100,(1-(nextTime-now)/a.period)*100))+'%';
 if(beat!==a.lastBeat){
  a.lastBeat=beat;
  const index=Math.max(0,Math.min(l.length-1,beat-4));
  const drum=a.notes[index].drum;
  $('cameraBeatNumber').textContent=beat<4?'COUNT IN · '+Math.max(1,4-Math.max(0,beat)):`BEAT ${index+1} / ${l.length}`;
  $('cameraBeatAction').textContent=(beat<4?'Get ready: ':'HIT ')+names[drum];
  $('cameraBeatNext').textContent=beat<4?'Start after four clicks':index+1<l.length?'Next: '+names[a.notes[index+1].drum]:'Final hit';
  $('cameraBeatQueue').innerHTML=a.notes.slice(index,index+4).map((note,offset)=>`<span class="${offset===0?'current-beat':''}"><b>${index+offset+1}</b> ${names[note.drum]}</span>`).join('');
  if(beat>=4){
   const target=$(drum);
   target?.animate([{outlineColor:'#ffffff',boxShadow:'0 0 40px #ffffff'},{outlineColor:'#45e4b3',boxShadow:'0 0 20px #45e4b3'}],{duration:Math.min(280,a.period*500)});
   $('cameraBeatAction').animate([{background:'#fff',color:'#125b49'},{background:'#125b49',color:'#fff'}],{duration:200});
  }
  if(beat<4){$('beatLabel').textContent='COUNT IN';$('beatCue').textContent=String(Math.max(1,4-Math.max(0,beat)));}
  else{const index=Math.min(l.length-1,beat-4);$('beatLabel').textContent=`BEAT ${index+1} OF ${l.length}`;$('beatCue').textContent=names[a.notes[index].drum];$('trainNext').textContent=index+1<l.length?'Next: '+names[a.notes[index+1].drum]:'Last beat. Let it ring.';document.querySelectorAll('.zone').forEach(z=>z.classList.toggle('training-target',z.id===a.notes[index].drum));}
 }
 if(now>a.notes.at(-1).time+.4)finish();
}
window.addEventListener('air-drum-played',e=>{
 if(!active||e.detail.input!=='camera'||e.detail.time<active.notes[0].time-.2)return;
 active.hits.push({drum:e.detail.drum,time:e.detail.time});
 const scored=scoreAttempt(active.notes,active.hits);
 $('trainReaction').textContent=scored.matched> (active.previousMatched||0)?'Nice! Keep the beat going.':'Find the next click. You have this.';
 active.previousMatched=scored.matched;
});
function finish(){
 const attempt=active,l=lessons[attempt.lesson],result=scoreAttempt(attempt.notes,attempt.hits);
 cancel();
 const rewards=rewardProgress(progress,attempt.lesson,result.score,today());progress=rewards.progress;
 let saved=true;try{localStorage.setItem('air-drum-training-v1',JSON.stringify(progress));}catch{saved=false;}
 const entry={id:crypto.randomUUID(),lesson:attempt.lesson,date:new Date().toISOString(),score:result.score,matched:result.matched,total:result.total,meanError:result.meanError,extra:result.extra,drums:summarizeDrums(attempt.notes,attempt.hits),feedback:result.score>=60?'Keep movements relaxed and aim for consistent timing.':'Listen again and focus on one clean hit per click.',source:'practice'};
 const prior=history.slice(-5);history.push(entry);history=history.slice(-50);saveMemory();
 root.dataset.attempt=entry.id;
 const passed=result.score>=60;
 root.innerHTML=`<div class="train-result">${mascot(l.kind,140)}<span class="train-eyebrow">${passed?'LESSON COMPLETE':'EVERY REP COUNTS'}</span><h2>${result.score>=90?'You found your groove!':passed?'That is music to our ears.':'Take a breath. Try again.'}</h2><div class="result-score">${result.score}<small>%</small></div><p>${result.matched} / ${result.total} beats matched · ${result.extra} extra hits${result.meanError!==null?' · '+result.meanError+' ms average timing error':''}</p><div class="result-rewards"><span>◆ +${rewards.earned} diamonds</span><span>✦ +${rewards.xp} XP</span><span>🔥 ${streak()} day streak</span></div><p id="trainCoach" role="status">${passed?'Keep those movements relaxed. Your next challenge is waiting.':'Listen once more, then aim for one clean hit on each click. You need 60% to unlock the next lesson.'}</p><small id="coachSource">Practice tip${saved?'':' · Progress could not be saved in this browser.'}</small><div class="result-actions"><button class="train-primary" id="backToPath">${passed?'Back to the path':'Try again'}</button><button class="train-secondary" id="showPath">View all lessons</button></div></div>`;
 $('backToPath').onclick=()=>{if(passed){selected=Math.min(attempt.lesson+1,lessons.length-1);render();}else{prepareLesson();}};
 $('showPath').onclick=render;
 request=new AbortController();const signal=request.signal;
 fetch('/train-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...entry,history:prior}),signal}).then(r=>r.ok?r.json():null).then(data=>{if(!signal.aborted&&data?.feedback){entry.feedback=data.feedback;entry.source=data.source;if(history.includes(entry))saveMemory();if(root.dataset.attempt===entry.id&&$('trainCoach')){$('trainCoach').textContent=data.feedback;$('coachSource').textContent=data.source==='ai'?'AI coach · saved for next time':'Practice tip · saved for next time';}}}).catch(()=>{});
}
function leave(){cancel();training=false;root.hidden=true;workspace.hidden=false;trainButton.classList.remove('selected');trainButton.setAttribute('aria-pressed','false');}
trainButton.onclick=()=>{
 $('play').click();training=true;root.hidden=false;workspace.hidden=!showCamera;
 ['arrange','play'].forEach(id=>{$(id).classList.remove('selected');$(id).setAttribute('aria-pressed','false');});
 trainButton.classList.add('selected');trainButton.setAttribute('aria-pressed','true');render();
};
['arrange','play'].forEach(id=>$(id).addEventListener('click',leave));
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active){prepareLesson();$('lessonNotice').textContent='Lesson paused because the tab was hidden. Start again when ready.';}});
window.addEventListener('pagehide',cancel);
if(location.hash==='#train'){
 trainButton.click();
 const requested=new URLSearchParams(location.search).get('lesson');
 const index=Number(requested);
 if(requested!==null&&Number.isInteger(index)&&lessons[index]&&unlocked(index)){selected=index;prepareLesson();}
}
