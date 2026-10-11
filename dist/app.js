const $=id=>document.getElementById(id);
const defaults=[
 {id:'snare',label:'Snare',x:.36,y:.70,color:'#df8f77',scale:1},
 {id:'mid-tom',label:'Mid tom',x:.65,y:.65,color:'#b9c1c8',scale:1},
 {id:'crash',label:'Crash',x:.75,y:.30,color:'#c6b58a',scale:1.10},
 {id:'hi-hat',label:'Hi-hat',x:.23,y:.44,color:'#c6b58a',scale:.90}
];
let layout=defaults.map(d=>({...d})),mode='arrange',stream=null,pending=false,drag=null;
try{const saved=JSON.parse(localStorage.getItem('air-drum-layout-trio-v1'));if(Array.isArray(saved))layout=defaults.map(d=>{const s=saved.find(s=>s.id===d.id);return s&&Number.isFinite(s.x)&&Number.isFinite(s.y)?{...d,x:Math.max(.08,Math.min(.92,s.x)),y:Math.max(.08,Math.min(.92,s.y))}:{...d}})}catch{}
function save(){try{localStorage.setItem('air-drum-layout-trio-v1',JSON.stringify(layout))}catch{}}
function position(el,d){el.style.setProperty('--depth-scale',String(.6+.9*d.y));el.style.zIndex=String(10+Math.round(d.y*100));el.style.left=d.x*100+'%';el.style.top=d.y*100+'%'}
function bounds(d,x,y){
 const r=$('zones').getBoundingClientRect(),el=$(d.id);
 if(!r.width||!r.height)return;
 d.y=Math.max(0,Math.min(1,y));position(el,d);
 // Solve bounds using the unscaled size, so depth changes cannot clip the drum.
 const perspective=$('zones').classList.contains('show-3d');
 const baseHeight=el.offsetHeight/(perspective?(.6+.9*d.y):1);
 const k=baseHeight/(2*r.height);
 const lo=perspective?(.01+.6*k)/(1-.9*k):k+.01;
 const hi=perspective?( .99-.6*k)/(1+.9*k):.99-k;
 d.y=lo<=hi?Math.max(lo,Math.min(hi,y)):.5;position(el,d);
 const mx=Math.min(.49,el.offsetWidth/2/r.width+.01);
 d.x=Math.max(mx,Math.min(1-mx,x));position(el,d);
}
layout.forEach((d,i)=>{const el=document.createElement('button');el.id=d.id;el.className='zone';el.style.setProperty('--tone',d.color);el.innerHTML='<small>0'+(i+1)+'</small><span>'+d.label+'</span>';el.setAttribute('aria-label',d.label+'. Use arrow keys to reposition.');position(el,d);$('zones').appendChild(el);el.addEventListener('pointerdown',e=>{if(mode!=='arrange')return;const r=$('zones').getBoundingClientRect();drag={id:d.id,dx:e.clientX-r.left-d.x*r.width,dy:e.clientY-r.top-d.y*r.height};el.setPointerCapture(e.pointerId)});el.addEventListener('pointermove',e=>{if(mode!=='arrange'||drag?.id!==d.id)return;const r=$('zones').getBoundingClientRect();bounds(d,(e.clientX-r.left-drag.dx)/r.width,(e.clientY-r.top-drag.dy)/r.height)});const end=()=>{drag=null;save()};el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);el.addEventListener('keydown',e=>{if(mode!=='arrange'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?.05:.01;bounds(d,d.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),d.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));save()})});
function setMode(next){mode=next;drag=null;['arrange','play'].forEach(m=>{$(m).classList.toggle('selected',m===mode);$(m).setAttribute('aria-pressed',String(m===mode))});layout.forEach(d=>{const el=$(d.id);el.classList.toggle('locked',mode==='play');el.setAttribute('aria-label',d.label+(mode==='arrange'?'. Use arrow keys to reposition.':'. Position locked.'))});$('reset').disabled=mode==='play';$('modeCaption').textContent=mode.toUpperCase()+' MODE';$('stageHint').textContent=mode==='play'?'Positions locked • press Enable sound':'Drag each drum into position';$('modeHelp').textContent=mode==='play'?'Enable sound, then start tracking below. Strike down through the gold line on a drum; lift above it to strike again.':'Drag the circles over an object or into open space. Use arrow keys when a drum is focused.'}
$('arrange').onclick=()=>setMode('arrange');$('play').onclick=()=>setMode('play');$('reset').onclick=()=>{layout.forEach((d,i)=>{d.x=defaults[i].x;d.y=defaults[i].y;position($(d.id),d)});save()};
function stopped(){stream=null;$('video').srcObject=null;$('video').style.display='none';$('empty').hidden=false;$('cameraStatus').textContent='Camera off';$('statusDot').style.background='#89918b';$('cameraToggle').textContent='Enable camera';$('cameraDetail').textContent='Camera access is requested only when you enable it.'}
function stopCamera(){stream?.getTracks().forEach(t=>t.stop());stopped()}
function fitOverlay(){const v=$('video'),s=$('stage');if(!v.videoWidth){$('zones').style.inset='0';return}const scale=Math.min(s.clientWidth/v.videoWidth,s.clientHeight/v.videoHeight);const x=(s.clientWidth-v.videoWidth*scale)/2,y=(s.clientHeight-v.videoHeight*scale)/2;$('zones').style.inset=`${y}px ${x}px`;layout.forEach(d=>bounds(d,d.x,d.y))}
async function startCamera(){if(pending||stream)return;pending=true;$('error').hidden=true;$('enableCamera').disabled=true;$('cameraToggle').disabled=true;$('cameraStatus').textContent='Waiting for permission…';try{if(!window.isSecureContext)throw {name:'InsecureContext'};if(!navigator.mediaDevices?.getUserMedia)throw {name:'Unsupported'};stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720},frameRate:{ideal:60}},audio:false});$('video').srcObject=stream;await $('video').play();$('video').style.display='block';$('empty').hidden=true;$('cameraStatus').textContent='Camera live';$('statusDot').style.background='#a8c795';$('cameraToggle').textContent='Turn off camera';$('cameraDetail').textContent='Mirrored preview · microphone off';stream.getVideoTracks()[0].addEventListener('ended',()=>{stopCamera();$('error').textContent='The camera was disconnected or access ended. Reconnect it and enable the camera again.';$('error').hidden=false});fitOverlay()}catch(e){stopCamera();const messages={NotAllowedError:'Camera access was blocked. Allow camera access in your browser’s site permissions, then try again. If this preview cannot request access, open the page in a separate browser tab.',NotFoundError:'No camera was found. Connect a webcam, then try again.',NotReadableError:'Your camera could not start. Close other apps using it, check your device privacy settings, and try again.',OverconstrainedError:'This camera does not support the requested settings. Try another camera.',InsecureContext:'Camera access requires HTTPS or localhost. Open the secure published link or run the local preview server.',Unsupported:'This browser does not support camera access. Open this page in a current version of Chrome, Edge, Firefox, or Safari.'};$('error').textContent=messages[e.name]||'The camera could not start. Check your camera connection and browser permissions, then try again.';$('error').hidden=false}finally{pending=false;$('enableCamera').disabled=false;$('cameraToggle').disabled=false}}
$('enableCamera').onclick=startCamera;$('cameraToggle').onclick=()=>stream?stopCamera():startCamera();$('video').addEventListener('loadedmetadata',fitOverlay);new ResizeObserver(fitOverlay).observe($('stage'));window.addEventListener('pagehide',stopCamera);
// Integration contract: normalized coordinates refer to the mirrored, uncropped video image.
window.airDrumStudio={getLayout:()=>layout.map(({id,x,y})=>{const r=$('zones').getBoundingClientRect(),el=$(id);return{id,x,y,width:el.offsetWidth/r.width,height:el.offsetHeight/r.height}}),getMode:()=>mode};




