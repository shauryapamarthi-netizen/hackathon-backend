/* Original synthesized one-shot samples: no licensed sample downloads or API keys. */
window.drumAudio=(()=>{
 let ctx,master,ready=false;const buffers={};
 function sample(kind){
  const duration=kind==='crash'?1.8:kind==='hi-hat'?.13:.6;
  const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),a=b.getChannelData(0);let phase=0,prev=0;
  for(let i=0;i<a.length;i++){
   const t=i/ctx.sampleRate,n=Math.random()*2-1,hp=n-prev;prev=n;
   if(kind==='snare'){phase+=2*Math.PI*(170+70*Math.exp(-t*40))/ctx.sampleRate;a[i]=.48*hp*Math.exp(-t*19)+.5*Math.sin(phase)*Math.exp(-t*30);}
   else if(kind==='mid-tom'||kind==='kick'){const kick=kind==='kick';phase+=2*Math.PI*((kick?48:105)+(kick?100:95)*Math.exp(-t*35))/ctx.sampleRate;a[i]=Math.sin(phase)*Math.exp(-t*(kick?11:8))+.12*n*Math.exp(-t*110);}
   else{const env=Math.exp(-t*(kind==='crash'?3.5:45));a[i]=(.23*hp+.13*Math.sin(t*2*Math.PI*3271)*Math.sin(t*2*Math.PI*4217))*env;}
   a[i]=Math.max(-1,Math.min(1,a[i]));
  }return b;
 }
 async function init(){
  if(!ctx){ctx=new AudioContext({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=.7;const limiter=ctx.createDynamicsCompressor();master.connect(limiter);limiter.connect(ctx.destination);}
  await ctx.resume();if(!ready){for(const k of ['snare','mid-tom','hi-hat','crash','kick'])buffers[k]=sample(k);ready=true;}
 }
 function play(name,velocity=1,when){if(!ready||ctx.state!=='running'||!buffers[name])return false;const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buffers[name];g.gain.value=Number.isFinite(velocity)?Math.max(0,Math.min(1,velocity)):1;src.connect(g);g.connect(master);src.onended=()=>{src.disconnect();g.disconnect()};src.start(when??ctx.currentTime);return true;}
 function tick(when,accent){if(!ready)return;const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=accent?1300:900;g.gain.setValueAtTime(.12,when);g.gain.exponentialRampToValueAtTime(.001,when+.04);o.connect(g);g.connect(master);o.start(when);o.stop(when+.05);o.onended=()=>{o.disconnect();g.disconnect()};}
 return {init,play,tick,volume:v=>{if(master)master.gain.value=v},get context(){return ctx}};
})();
