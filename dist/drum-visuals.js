// CSS 3D geometry, rendered locally over the existing camera image.
const visualControls=document.createElement('section');
visualControls.className='visual-controls';
visualControls.innerHTML=`<div class="kit-heading"><h3>CAMERA OVERLAY</h3><span>3D kit</span></div>
<label for="kitPreset">Four-piece preset</label><select id="kitPreset"><option value="spatial">Spatial 3D kit</option><option value="reference">Top-down · reference layout</option></select>
<button id="applyPreset" class="preset-apply">Apply preset</button><p id="presetStatus" role="status">Choose a preset to arrange all four instruments.</p>
<label class="visual-switch"><input id="showDrums" type="checkbox" checked> Show 3D drums</label>
<label for="drumSize">Drum size <output id="sizeValue">110 px</output></label><input id="drumSize" type="range" min="70" max="170" value="110">
<label for="drumAngle">Viewing angle <output id="angleValue">45°</output></label><input id="drumAngle" type="range" min="0" max="65" value="45">
<p>Point your camera at your desk or floor. Drag the drums into place, then adjust the angle. 0° gives a straight-down view. Positions stay fixed on screen when the camera moves.</p>`;
document.querySelector('.kit-heading').before(visualControls);
function buildDrum(d){
 const cymbal=['hi-hat','crash','ride'].includes(d.id);
 const wrap=document.createElement('span');wrap.className='drum-model '+(cymbal?'cymbal-model':'shell-model');wrap.setAttribute('aria-hidden','true');
 const body=document.createElement('span');body.className='drum-body';
 // Stacked circular layers form the drum's shell and cymbal thickness.
 const layers=cymbal?0:28;
 for(let i=0;i<layers;i++){const layer=document.createElement('span');layer.className='drum-layer';layer.style.transform=`translateZ(${-i*(cymbal?1:1.1)}px)`;body.appendChild(layer)}

 const head=document.createElement('span');head.className='drum-head';body.appendChild(head);
 if(cymbal){const bell=document.createElement('span');bell.className='cymbal-bell';body.appendChild(bell)}else{
 for(let i=0;i<8;i++){const lug=document.createElement('span');lug.className='drum-lug';const angle=i*Math.PI/4;lug.style.left=(50+47*Math.cos(angle))+'%';lug.style.top=(50+47*Math.sin(angle))+'%';body.appendChild(lug)}
 }
 if(!cymbal){
 const bottom=document.createElement('span');bottom.className='bottom-hoop';body.appendChild(bottom);
 for(let i=0;i<8;i++){const rod=document.createElement('span');rod.className='tension-rod';const a=i*Math.PI/4;rod.style.left=(50+46*Math.cos(a))+'%';rod.style.top=(50+46*Math.sin(a))+'%';body.appendChild(rod)}
}
wrap.appendChild(body);
if(d.id==='hi-hat'){const rod=document.createElement('span');rod.className='hihat-shaft';wrap.appendChild(rod)}$(d.id).prepend(wrap);$(d.id).classList.add('visual-zone');$(d.id).style.setProperty('--piece-scale',d.scale);$(d.id).style.zIndex=String(d.id==='bass'?1:Math.round(d.y*10)+2);
}
layout.forEach(buildDrum);
document.querySelector('.kit').innerHTML=layout.map((d,i)=>`<div><i style="--tone:${d.color}"></i><span>${d.label}</span><small>0${i+1}</small></div>`).join('');

let presetView='reference';
try{if(localStorage.getItem('air-drum-preset')==='spatial')presetView='spatial'}catch{}
function setPresetView(value){presetView=value;$('zones').classList.toggle('spatial-kit',value==='spatial');$('kitPreset').value=value;try{localStorage.setItem('air-drum-preset',value)}catch{}}
setPresetView(presetView);
const spatialPositions={snare:[.36,.70],'mid-tom':[.65,.65],crash:[.75,.30],'hi-hat':[.23,.44]};
function applyPreset(){
 if(mode!=='arrange')return;
 setPresetView($('kitPreset').value);$('showDrums').checked=true;
 $('drumAngle').value=presetView==='spatial'?48:0;$('drumSize').value=110;
 layout.forEach((d,i)=>{const p=presetView==='spatial'?spatialPositions[d.id]:[defaults[i].x,defaults[i].y];d.x=p[0];d.y=p[1];position($(d.id),d)});
 updateVisuals();$('presetStatus').textContent=(presetView==='spatial'?'Spatial 3D':'Top-down')+' kit applied. Drag individual drums to customize.';
}
$('applyPreset').onclick=applyPreset;
function lockVisualControls(){const locked=mode==='play';['applyPreset','kitPreset','drumSize','drumAngle','showDrums'].forEach(id=>$(id).disabled=locked||(['drumSize','drumAngle'].includes(id)&&!$('showDrums').checked))}
['arrange','play'].forEach(id=>$(id).addEventListener('click',lockVisualControls));
$('reset').onclick=()=>{if(mode!=='arrange')return;$('kitPreset').value=presetView;applyPreset()};
function updateVisuals(){
 const enabled=$('showDrums').checked;
 $('zones').classList.toggle('show-3d',enabled);
 $('zones').style.setProperty('--drum-size',$('drumSize').value+'px');
 $('zones').style.setProperty('--drum-angle',$('drumAngle').value+'deg');
 $('sizeValue').value=$('drumSize').value+' px';$('angleValue').value=$('drumAngle').value+'°';
 lockVisualControls();
 layout.forEach(d=>bounds(d,d.x,d.y));save();
 try{localStorage.setItem('air-drum-visuals',JSON.stringify({enabled,size:+$('drumSize').value,angle:+$('drumAngle').value}))}catch{}
}
try{const settings=JSON.parse(localStorage.getItem('air-drum-visuals'));if(settings){$('showDrums').checked=settings.enabled!==false;if(Number.isFinite(settings.size))$('drumSize').value=Math.max(70,Math.min(170,settings.size));if(Number.isFinite(settings.angle))$('drumAngle').value=Math.max(0,Math.min(65,settings.angle))}}catch{}
['showDrums','drumSize','drumAngle'].forEach(id=>$(id).addEventListener('input',updateVisuals));updateVisuals();



