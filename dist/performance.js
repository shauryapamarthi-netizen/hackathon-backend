const $=id=>document.getElementById(id), studio=window.airDrumStudio, audio=window.drumAudio;
let session=[],sessionStart=0,recording=false,metro=null,nextBeat=0,beat=0,tempo=90;
const panel=document.createElement('section');panel.className='performance';panel.innerHTML=`
<h3>PLAY YOUR SPACE</h3><button id="soundOn" class="primary">Enable sound</button>
<p>Click a drum or use A / S / D / F / Space to play.</p><div id="audioStatus" role="status">Enable sound to begin.</div>
<label>Volume <input id="volume" type="range" min="0" max="100" value="70"></label>
<div class="test-pads"><button data-hit="hi-hat">A · Hi-hat</button><button data-hit="snare">S · Snare</button><button data-hit="mid-tom">D · Tom</button><button data-hit="crash">F · Crash</button><button data-hit="kick">Space · Kick</button></div>
<div class="readouts"><span id="hitCount">0 hits</span><span id="lastHit">Ready</span></div>
<label>Practice tempo <input id="bpm" type="number" min="40" max="220" value="90"></label><button id="metro" class="reset">Start metronome</button>
<button id="record" class="reset">Record practice</button><button id="download" class="reset" disabled>Export hit log</button><p id="feedback" role="status">Practice one hit per click. Your timing summary appears after recording.</p>`;
document.querySelector('aside').append(panel);
document.querySelector('.backend').textContent='Local sound engine · no API key';
let hits=0;
function status(s){$('audioStatus').textContent=s;}
function hit(id,velocity=1,source='manual'){
 if(!audio.play(id,velocity))return false;
 hits++;$('hitCount').textContent=`${hits} hits`;$('lastHit').textContent=id;
 const el=$(id);if(el){el.classList.remove('struck');void el.offsetWidth;el.classList.add('struck');}
 if(recording&&session.length<50000)session.push({drum:id,velocity,source,timestamp:performance.now()-sessionStart,audioTime:audio.context.currentTime});
 return true;
}
async function enableSound(){await audio.init();audio.volume(+$('volume').value/100);$('soundOn').textContent='Sound enabled ✓';status('Sound ready.');}
$('soundOn').onclick=()=>enableSound().catch(e=>status('Audio could not start: '+e.message));
$('volume').oninput=()=>audio.volume(+$('volume').value/100);
for(const b of panel.querySelectorAll('[data-hit]'))b.onclick=async()=>{try{await enableSound();hit(b.dataset.hit)}catch(e){status(e.message)}};
for(const z of document.querySelectorAll('.zone'))z.addEventListener('click',async()=>{if(studio.getMode()==='play'){try{await enableSound();hit(z.id)}catch(e){status(e.message)}}});
window.addEventListener('keydown',async e=>{if(e.repeat||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;const id={KeyA:'hi-hat',KeyS:'snare',KeyD:'mid-tom',KeyF:'crash',Space:'kick'}[e.code];if(id){e.preventDefault();try{await enableSound();hit(id)}catch(err){status(err.message)}}});
// Teammate integration: one call per detected strike after the player enables sound.
const aliases={hihat:'hi-hat','hihat-closed':'hi-hat',tom:'mid-tom','tom-low':'mid-tom','tom-high':'mid-tom',bass:'kick'};
window.airDrumStudio.hit=(name,velocity=1)=>{
 const id=aliases[name]||name;
 if(studio.getMode()!=='play'||!['hi-hat','snare','mid-tom','crash','kick'].includes(id)||!Number.isFinite(velocity))return false;
 return hit(id,Math.max(0,Math.min(1,velocity)),'external');
};
window.addEventListener('drum-hit',event=>{
 const detail=event.detail;
 if(detail&&typeof detail==='object')window.airDrumStudio.hit(detail.drum,detail.velocity??1);
});
function stopMetro(){clearInterval(metro);metro=null;$('metro').textContent='Start metronome';}
$('metro').onclick=async()=>{if(metro){stopMetro();return}try{await enableSound();tempo=Math.max(40,Math.min(220,Number($('bpm').value)||90));$('bpm').value=tempo;nextBeat=audio.context.currentTime+.1;beat=0;const schedule=()=>{while(nextBeat<audio.context.currentTime+.08){audio.tick(nextBeat,beat%4===0);nextBeat+=60/tempo;beat++;}};metro=setInterval(schedule,25);schedule();$('metro').textContent='Stop metronome';}catch(e){status(e.message)}};
let practiceOrigin=0,practicePeriod=0;
$('record').onclick=async()=>{if(!recording){try{await enableSound()}catch(e){status(e.message);return}session=[];sessionStart=performance.now();recording=true;practiceOrigin=metro?nextBeat:0;practicePeriod=60/tempo;$('record').textContent='Finish practice';$('bpm').disabled=true;$('metro').disabled=true;$('download').disabled=true;$('feedback').textContent='Recording… Play one hit per metronome click for timing feedback.';}else{recording=false;$('record').textContent='Record practice';$('bpm').disabled=false;$('metro').disabled=false;$('download').disabled=!session.length;let summary=`${session.length} hits in ${((performance.now()-sessionStart)/1000).toFixed(1)} seconds.`;
 if(session.length>=4&&practiceOrigin){const errors=session.map(h=>{const beats=(h.audioTime-practiceOrigin)/practicePeriod;return Math.abs(beats-Math.round(beats))*practicePeriod*1000});const avg=errors.reduce((a,b)=>a+b,0)/errors.length;summary+=` Average distance to the nearest click: ${Math.round(avg)} ms. ${avg<60?'Try keeping that consistency at a slightly faster tempo.':'Slow the tempo and aim for one relaxed stroke per click.'}`;}else summary+=' Record at least four hits with the metronome on for timing feedback.';$('feedback').textContent=summary;}};
$('download').onclick=()=>{const blob=new Blob([JSON.stringify({tempoBpm:tempo,hits:session},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='air-drum-session.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',stopMetro);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMetro();status('Metronome paused while this tab is hidden.')}});
