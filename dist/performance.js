import { HandSession, getHandPoints } from './hand-session.js';
import { HandInput } from './hand-input.js';
const $=id=>document.getElementById(id), studio=window.airDrumStudio, audio=window.drumAudio;
const handInput=new HandInput(new HandSession(),getHandPoints);
const detector=new window.StrikeDetector();let running=false,landmarker,loading=false,raf=0,lastFrame=-1,socket=null,session=[],sessionStart=0,recording=false,metro=null,nextBeat=0,beat=0,tempo=90;
const panel=document.createElement('section');panel.className='performance';panel.innerHTML=`
<h3>PLAY YOUR SPACE</h3><button id="soundOn" class="primary">Enable sound</button>
<label>Input<select id="inputMode"><option value="hands">Hands · five-point tracking</option><option value="markers">Sticks · pink + cyan tips</option><option value="backend">Backend · hit events</option></select></label>
<p id="inputHelp">Show both open hands briefly to select them. Five dots follow each hand; index fingertips play the drums. Any one matching point can keep a hand selected.</p>
<button id="trackToggle" class="reset">Start tracking</button><button id="setupHands" class="reset" disabled>Set up hands again</button><div id="trackingStatus" role="status">Sound and tracking are off.</div>
<label>Sensitivity <input id="sensitivity" type="range" min="10" max="100" value="65"></label>
<label>Volume <input id="volume" type="range" min="0" max="100" value="70"></label>
<div id="backendSettings" hidden><label>WebSocket URL<input id="wsUrl" placeholder="wss://your-server/ws"></label><p>Connects to an existing backend that sends drum_hit events. No camera frames are uploaded by this client.</p></div>
<div class="test-pads"><button data-hit="hi-hat">A · Hi-hat</button><button data-hit="snare">S · Snare</button><button data-hit="mid-tom">D · Tom</button><button data-hit="crash">F · Crash</button><button data-hit="kick">Space · Kick</button></div>
<div class="readouts"><span id="hitCount">0 hits</span><span id="lastHit">Ready</span></div>
<label>Practice tempo <input id="bpm" type="number" min="40" max="220" value="90"></label><button id="metro" class="reset">Start metronome</button>
<button id="record" class="reset">Record practice</button><button id="download" class="reset" disabled>Export hit log</button><p id="feedback" role="status">Practice one hit per click. Your timing summary appears after recording.</p>`;
document.querySelector('aside').append(panel);
document.querySelector('.backend').textContent='Local sound engine · no API key';
const canvas=document.createElement('canvas');canvas.className='tracking-overlay';$('zones').append(canvas);const pen=canvas.getContext('2d');
let hits=0;
function status(s){$('trackingStatus').textContent=s;}
function hit(id,velocity=1,source='manual'){
 if(!audio.play(id,velocity))return;
 hits++;$('hitCount').textContent=`${hits} hits`;$('lastHit').textContent=id;
 const el=$(id);if(el){el.classList.remove('struck');void el.offsetWidth;el.classList.add('struck');}
 if(recording&&session.length<50000)session.push({drum:id,velocity,source,timestamp:performance.now()-sessionStart,audioTime:audio.context.currentTime});
}
async function enableSound(){await audio.init();audio.volume(+$('volume').value/100);$('soundOn').textContent='Sound enabled ✓';}
$('soundOn').onclick=()=>enableSound().catch(e=>status('Audio could not start: '+e.message));
$('volume').oninput=()=>audio.volume(+$('volume').value/100);
$('sensitivity').oninput=()=>{detector.threshold=(110-+$('sensitivity').value)/100;};$('sensitivity').oninput();
for(const b of panel.querySelectorAll('[data-hit]'))b.onclick=async()=>{try{await enableSound();hit(b.dataset.hit)}catch(e){status(e.message)}};
for(const z of document.querySelectorAll('.zone'))z.addEventListener('click',async()=>{if(studio.getMode()==='play'){try{await enableSound();hit(z.id)}catch(e){status(e.message)}}});
window.addEventListener('keydown',async e=>{if(e.repeat||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const id={KeyA:'hi-hat',KeyS:'snare',KeyD:'mid-tom',KeyF:'crash',Space:'kick'}[e.code];if(id){e.preventDefault();try{await enableSound();hit(id)}catch(err){status(err.message)}}});
function render(points,zones){const r=$('zones').getBoundingClientRect();if(canvas.width!==Math.round(r.width)||canvas.height!==Math.round(r.height)){canvas.width=Math.round(r.width);canvas.height=Math.round(r.height);}pen.clearRect(0,0,canvas.width,canvas.height);pen.lineWidth=2;
 for(const z of zones){pen.strokeStyle='#f4d196';pen.beginPath();pen.moveTo((z.x-z.width*.5)*canvas.width,(z.y-z.height*.15)*canvas.height);pen.lineTo((z.x+z.width*.5)*canvas.width,(z.y-z.height*.15)*canvas.height);pen.stroke();}
 for(const p of points){pen.fillStyle=p.color||(p.id==='cyan'?'#6affff':'#ff8bd9');pen.beginPath();pen.arc(p.x*canvas.width,p.y*canvas.height,p.radius||8,0,Math.PI*2);pen.fill();}
}
// Find the largest connected color blob for each stick, rather than averaging unrelated pixels.
const scratch=document.createElement('canvas');scratch.width=320;scratch.height=180;const cx=scratch.getContext('2d',{willReadFrequently:true});
function markers(video){cx.drawImage(video,0,0,320,180);const data=cx.getImageData(0,0,320,180).data,out=[];
 for(const name of ['pink','cyan']){const mask=new Uint8Array(320*180);for(let i=0;i<mask.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2];mask[i]=name==='pink'?(r>110&&b>85&&r>g*1.45&&b>g*1.3):(g>100&&b>100&&g>r*1.4&&b>r*1.4);}
  let best=null;for(let i=0;i<mask.length;i++){if(!mask[i])continue;let q=[i],n=0,sx=0,sy=0;mask[i]=0;for(let k=0;k<q.length;k++){const at=q[k],x=at%320,y=Math.floor(at/320);n++;sx+=x;sy+=y;for(const next of [x>0?at-1:-1,x<319?at+1:-1,y>0?at-320:-1,y<179?at+320:-1])if(next>=0&&mask[next]){mask[next]=0;q.push(next);}}
   if(n>=5&&n<2500&&(!best||n>best.n))best={n,x:sx/n,y:sy/n};}
  if(best)out.push({id:name,x:1-best.x/320,y:best.y/180});
 }return out;
}
async function loadHands(){if(landmarker)return;status('Loading hand model… Internet is needed for the first load.');
 const {FilesetResolver,HandLandmarker}=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
 const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
 const options={baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5};
 try{landmarker=await HandLandmarker.createFromOptions(files,options)}catch{options.baseOptions.delegate='CPU';landmarker=await HandLandmarker.createFromOptions(files,options)}
}
function scheduleFrame(){const v=$('video');raf=v.requestVideoFrameCallback?v.requestVideoFrameCallback(frame):requestAnimationFrame(frame);}
function frame(now){if(!running)return;const v=$('video');
 try{if(!v.srcObject||v.readyState<2){stop();status('Camera is off. Enable the camera, then start tracking again.');return;}
 if(v.currentTime!==lastFrame){lastFrame=v.currentTime;let points,displayed,selection;
 if($('inputMode').value==='markers'){points=markers(v);displayed=points;}
 else{
  selection=handInput.update(landmarker.detectForVideo(v,now),now);
  if(selection.timedOut){stop();studio.stopCamera();status('No hands seen for 10 seconds. Enable the camera and start tracking again.');return;}
  points=selection.strikePoints;displayed=selection.overlayPoints;
  window.dispatchEvent(new CustomEvent('hands-detected',{detail:selection}));
 }
 const zones=studio.getLayout();render(displayed,zones);
 if(studio.getMode()==='play'){for(const h of detector.update(points,zones,now))hit(h.drum,h.velocity,h.source)}else detector.reset();
 status(selection?selection.message:points.length?`${points.length} tracked · ${studio.getMode()==='play'?'strike down through a gold line':'switch to Play when positioned'}`:'No input detected · keep colored tips visible');
 }scheduleFrame();
 }catch(e){stop();status('Tracking stopped: '+e.message);}
}
function stop(){
 running=false;
 const v=$('video');if(v.cancelVideoFrameCallback)v.cancelVideoFrameCallback(raf);else cancelAnimationFrame(raf);
 detector.reset();lastFrame=-1;handInput.reset(performance.now());
 if(socket){socket.onclose=null;socket.close();socket=null;}
 landmarker?.close();landmarker=null;
 $('trackToggle').textContent='Start tracking';$('setupHands').disabled=true;
 pen.clearRect(0,0,canvas.width,canvas.height);
 window.dispatchEvent(new CustomEvent('hands-detected',{detail:{hands:[],previewHands:[],state:'stopped',timestampMs:performance.now()}}));
}
$('setupHands').onclick=()=>{handInput.reset(performance.now());detector.reset();pen.clearRect(0,0,canvas.width,canvas.height);status('Show both open hands, separated, to select them again.');};
window.addEventListener('air-drum-camera-stopped',()=>{if(running&&$('inputMode').value!=='backend'){stop();status('Camera stopped. Enable it and start tracking again.');}});
const aliases={hihat:'hi-hat','hihat-closed':'hi-hat',tom:'mid-tom','tom-low':'mid-tom','tom-high':'mid-tom',bass:'kick'};
function backend(){const url=new URL($('wsUrl').value);if(!['ws:','wss:'].includes(url.protocol))throw Error('Use a ws:// or wss:// URL.');if(location.protocol==='https:'&&url.protocol!=='wss:')throw Error('A hosted HTTPS page needs a secure wss:// backend.');
 socket=new WebSocket(url);const ws=socket;status('Connecting to backend…');const seen=new Set();
 ws.onopen=()=>status('Backend connected · waiting for drum_hit events');
 ws.onmessage=e=>{try{if(typeof e.data!=='string'||e.data.length>8192)return;const m=JSON.parse(e.data);if(m.type!=='drum_hit'||studio.getMode()!=='play')return;const id=aliases[m.drum]||m.drum;const velocity=m.velocity??1;if(!['hi-hat','snare','mid-tom','crash','kick'].includes(id)||!Number.isFinite(velocity))return;if(m.eventId){if(seen.has(m.eventId))return;seen.add(m.eventId);if(seen.size>1000)seen.delete(seen.values().next().value);}hit(id,Math.max(0,Math.min(1,velocity)),'backend');}catch{status('Ignored an invalid backend message.');}};
 ws.onerror=()=>status('Backend connection failed. Check the URL and server.');ws.onclose=()=>{if(socket===ws){stop();status('Backend disconnected. Start tracking to reconnect.')}};
}
$('trackToggle').onclick=async()=>{if(running){stop();status('Tracking stopped.');return}if(loading)return;loading=true;$('trackToggle').disabled=true;$('inputMode').disabled=true;
 try{await enableSound();if($('inputMode').value==='backend'){backend();running=true;}else{if(!$('video').srcObject)throw Error('Enable the camera first.');if($('inputMode').value==='hands')await loadHands();handInput.reset(performance.now());running=true;scheduleFrame();$('setupHands').disabled=$('inputMode').value!=='hands';}$('trackToggle').textContent='Stop tracking';}catch(e){stop();status(e.message+' You can still test the drum buttons.');}finally{loading=false;$('trackToggle').disabled=false;$('inputMode').disabled=false;}};
$('inputMode').onchange=()=>{stop();$('backendSettings').hidden=$('inputMode').value!=='backend';$('inputHelp').textContent=$('inputMode').value==='markers'?'Wrap one tip in bright pink tape and the other in cyan tape. Use good light and a plain background without those colors. Markers should appear at least 5 pixels wide.':$('inputMode').value==='hands'?'Show both open hands briefly to select them. Five dots follow each hand; index fingertips play the drums. Any one matching point can keep a hand selected.':'Your backend supplies drum hits; this mode does not run camera tracking or send video.';status('Input changed. Press Start tracking.');};
$('arrange').addEventListener('click',()=>{detector.reset()});$('play').addEventListener('click',()=>{$('stageHint').textContent='Strike down through a gold line';});
function stopMetro(){clearInterval(metro);metro=null;$('metro').textContent='Start metronome';}
$('metro').onclick=async()=>{if(metro){stopMetro();return}try{await enableSound();tempo=Math.max(40,Math.min(220,Number($('bpm').value)||90));$('bpm').value=tempo;nextBeat=audio.context.currentTime+.1;beat=0;const schedule=()=>{while(nextBeat<audio.context.currentTime+.08){audio.tick(nextBeat,beat%4===0);nextBeat+=60/tempo;beat++;}};metro=setInterval(schedule,25);schedule();$('metro').textContent='Stop metronome';}catch(e){status(e.message)}};
let practiceOrigin=0,practicePeriod=0;
$('record').onclick=async()=>{if(!recording){try{await enableSound()}catch(e){status(e.message);return}session=[];sessionStart=performance.now();recording=true;practiceOrigin=metro?nextBeat:0;practicePeriod=60/tempo;$('record').textContent='Finish practice';$('bpm').disabled=true;$('metro').disabled=true;$('download').disabled=true;$('feedback').textContent='Recording… Play one hit per metronome click for timing feedback.';}else{recording=false;$('record').textContent='Record practice';$('bpm').disabled=false;$('metro').disabled=false;$('download').disabled=!session.length;let summary=`${session.length} hits in ${((performance.now()-sessionStart)/1000).toFixed(1)} seconds.`;
 if(session.length>=4&&practiceOrigin){const errors=session.map(h=>{const beats=(h.audioTime-practiceOrigin)/practicePeriod;return Math.abs(beats-Math.round(beats))*practicePeriod*1000});const avg=errors.reduce((a,b)=>a+b,0)/errors.length;summary+=` Average distance to the nearest click: ${Math.round(avg)} ms. ${avg<60?'Try keeping that consistency at a slightly faster tempo.':'Slow the tempo and aim for one relaxed stroke per click.'}`;}else summary+=' Record at least four hits with the metronome on for timing feedback.';$('feedback').textContent=summary;}};
$('download').onclick=()=>{const blob=new Blob([JSON.stringify({tempoBpm:tempo,hits:session},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='air-drum-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',()=>{stop();stopMetro()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();stopMetro();status('Paused while this tab is hidden. Start tracking to resume.')}});
