// Module scope (studio.html loads this as type="module") so we don't clash with app.js's `$`.
const $ = (id) => document.getElementById(id);
const studio = window.airDrumStudio;
const audio = window.drumAudio;
if (!studio || !audio || !window.StrikeDetector || !window.PencilTracker) {
  const aside = document.querySelector('aside');
  if (aside) {
    const err = document.createElement('p');
    err.style.cssText = 'color:#f4d196;margin-top:16px';
    err.textContent = 'Pencil tracking failed to load. Hard-refresh (⌘⇧R) or re-upload strike-detector.js + pencil-tracker.js.';
    aside.append(err);
  }
  throw new Error('Missing air-drum dependencies');
}
const detector = new window.StrikeDetector();
const pencils = new window.PencilTracker();

let running = false;
let loading = false;
let raf = 0;
let lastFrame = -1;
let socket = null;
let session = [];
let sessionStart = 0;
let recording = false;
let metro = null;
let nextBeat = 0;
let beat = 0;
let tempo = 90;
let hits = 0;

const panel = document.createElement('section');
panel.className = 'performance';
panel.innerHTML = `
<h3>PLAY YOUR SPACE</h3>
<button id="soundOn" class="primary">Enable sound</button>
<label>Pencil input
  <select id="inputMode">
    <option value="neon">Pencils · pink + cyan tips</option>
    <option value="yellow">Pencils · yellow wood (#2)</option>
    <option value="backend">Backend · hit events</option>
  </select>
</label>
<p id="inputHelp">Wrap one tip in bright pink / magenta tape and the other in cyan. Good light, plain background. Tip dots should follow the pencil ends.</p>
<button id="trackToggle" class="reset">Start pencil tracking</button>
<div id="trackingStatus" role="status">Sound and pencil tracking are off.</div>
<div id="markerSettings"><button id="selectTips" class="reset">Select / reset tips</button><p>Click each pink or cyan taped tip in the camera image. Click Done selecting before playing. If a tip is lost, select it again.</p></div><label>Hitbox radius <input id="hitRadius" type="range" min="3" max="40" value="12"><output id="radiusValue">12 px</output></label>
<label>Sensitivity <input id="sensitivity" type="range" min="10" max="100" value="72"></label>
<label>Volume <input id="volume" type="range" min="0" max="100" value="70"></label>
<div id="backendSettings" hidden>
  <label>WebSocket URL<input id="wsUrl" placeholder="wss://your-server/ws"></label>
  <p>Receives drum_hit events only. Camera frames stay on this device.</p>
</div>
<div class="test-pads">
  <button data-hit="hi-hat">A · Hi-hat</button>
  <button data-hit="snare">S · Snare</button>
  <button data-hit="mid-tom">D · Tom</button>
  <button data-hit="crash">F · Crash</button>
  <button data-hit="kick">Space · Kick</button>
</div>
<div class="readouts"><span id="hitCount">0 hits</span><span id="lastHit">Ready</span></div>
<label>Practice tempo <input id="bpm" type="number" min="40" max="220" value="90"></label>
<button id="metro" class="reset">Start metronome</button>
<button id="record" class="reset">Record practice</button>
<button id="download" class="reset" disabled>Export hit log</button>
<p id="feedback" role="status">Strike down through a gold line. Bounce or lift to re-arm for rolls.</p>`;
document.querySelector('aside').append(panel);
document.querySelector('.backend').textContent = 'Pencil tracking · local sound · no API key';

const canvas = document.createElement('canvas');
canvas.className = 'tracking-overlay';
$('zones').append(canvas);
const pen = canvas.getContext('2d');
let selecting=false, woodSlot=0;
const markerLock=pencils.lock;
function selectMode(on){selecting=on;canvas.style.pointerEvents=on?'auto':'none';canvas.style.cursor=on?'crosshair':'';$('selectTips').textContent=on?'Done selecting':'Select / reset tips';detector.reset();}
$('selectTips').onclick=()=>{if(!running){status('Start tracking first.');return;}if(!selecting){markerLock.reset();woodSlot=0;}selectMode(!selecting);};
$('hitRadius').oninput=()=>{$('radiusValue').textContent=$('hitRadius').value+' px';detector.reset();};
canvas.onpointerdown=e=>{if(!selecting)return;e.preventDefault();e.stopPropagation();const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;const near=pencils.candidates.map(p=>({...p,d:Math.hypot((p.x-x)*r.width,(p.y-y)*r.height)})).filter(p=>p.d<24).sort((a,b)=>a.d-b.d);if(near.length){const p=near[0];for(const [id,prev] of markerLock.tracks)if(Math.hypot(prev.x-p.x,prev.y-p.y)<.04)markerLock.tracks.delete(id);markerLock.select(p.id==='wood'?(woodSlot++%2?'right':'left'):p.id,p,performance.now());status('Tip selected. Select the other tip or click Done selecting.');}};



function status(s) {
  $('trackingStatus').textContent = s;
}

function hit(id, velocity = 1, source = 'manual') {
  if (!audio.play(id, velocity)) return false;
  hits++;
  $('hitCount').textContent = `${hits} hits`;
  $('lastHit').textContent = id;
  const el = $(id);
  if (el) {
    el.classList.remove('struck');
    void el.offsetWidth;
    el.classList.add('struck');
  }
  if (recording && session.length < 50000) {
    session.push({
      drum: id,
      velocity,
      source,
      timestamp: performance.now() - sessionStart,
      audioTime: audio.context.currentTime,
    });
  }
  return true;
}

async function enableSound() {
  await audio.init();
  audio.volume(+$('volume').value / 100);
  $('soundOn').textContent = 'Sound enabled ✓';
}

$('soundOn').onclick = () => enableSound().catch((e) => status('Audio could not start: ' + e.message));
$('volume').oninput = () => audio.volume(+$('volume').value / 100);
$('sensitivity').oninput = () => {
  detector.threshold = (115 - +$('sensitivity').value) / 100;
};
$('sensitivity').oninput();

for (const b of panel.querySelectorAll('[data-hit]')) {
  b.onclick = async () => {
    try {
      await enableSound();
      hit(b.dataset.hit);
    } catch (e) {
      status(e.message);
    }
  };
}
for (const z of document.querySelectorAll('.zone')) {
  z.addEventListener('click', async () => {
    if (studio.getMode() === 'play') {
      try {
        await enableSound();
        hit(z.id);
      } catch (e) {
        status(e.message);
      }
    }
  });
}
window.addEventListener('keydown', async (e) => {
  if (e.repeat || /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const id = { KeyA: 'hi-hat', KeyS: 'snare', KeyD: 'mid-tom', KeyF: 'crash', Space: 'kick' }[e.code];
  if (id) {
    e.preventDefault();
    try {
      await enableSound();
      hit(id);
    } catch (err) {
      status(err.message);
    }
  }
});

const tipColor = {
  pink: '#ff8bd9',
  cyan: '#6affff',
  left: '#ffd27a',
  right: '#9ad7ff',
};

function render(points, zones) {
  const r = $('zones').getBoundingClientRect();
  const w = Math.round(r.width);
  const h = Math.round(r.height);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  pen.clearRect(0, 0, canvas.width, canvas.height);
  pen.lineWidth = 2;
  for (const z of zones) {
    pen.strokeStyle = '#f4d196';
    pen.beginPath();
    pen.moveTo((z.x - z.width * 0.5) * canvas.width, (z.y - z.height * 0.15) * canvas.height);
    pen.lineTo((z.x + z.width * 0.5) * canvas.width, (z.y - z.height * 0.15) * canvas.height);
    pen.stroke();
  }
  for (const p of points) {
    pen.fillStyle = tipColor[p.id] || '#fff';
    pen.beginPath();
    pen.arc(p.x * canvas.width, p.y * canvas.height, +$('hitRadius').value, 0, Math.PI * 2);
    pen.fill();
    pen.strokeStyle = 'rgba(0,0,0,.35)';
    pen.stroke();
  }
}

function frame(now) {
  if (!running) return;
  const v = $('video');
  try {
    if (!v.srcObject || v.readyState < 2) {
      stop();
      status('Camera is off. Enable the camera, then start pencil tracking again.');
      return;
    }
    if (v.currentTime !== lastFrame) {
      lastFrame = v.currentTime;
      let points = pencils.detect(v);
      const zones = studio.getLayout();
      render(selecting ? pencils.candidates : points, zones);
      points=points.map(p=>({...p,rx:+$('hitRadius').value/canvas.width,ry:+$('hitRadius').value/canvas.height}));
      if (studio.getMode() === 'play' && !selecting) {
        for (const h of detector.update(points, zones, now)) hit(h.drum, h.velocity, h.source);
      } else {
        detector.reset();
      }
      status(
        points.length
          ? `${points.length} tip${points.length > 1 ? 's' : ''} · ${
              studio.getMode() === 'play'
                ? 'strike down through a gold line · bounce/lift to roll'
                : 'switch to Play when positioned'
            }`
          : $('inputMode').value === 'yellow'
            ? 'No locked pencils · use Select / reset tips'
            : 'No locked tips · use Select / reset tips'
      );
    }
    raf = requestAnimationFrame(frame);
  } catch (e) {
    stop();
    status('Tracking stopped: ' + e.message);
  }
}

function stop() {
  running = false;
  selectMode(false);
  cancelAnimationFrame(raf);
  detector.reset();
  pencils.reset();
  lastFrame = -1;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  $('trackToggle').textContent = 'Start pencil tracking';
  pen.clearRect(0, 0, canvas.width, canvas.height);
}

const aliases = {
  hihat: 'hi-hat',
  'hihat-closed': 'hi-hat',
  tom: 'mid-tom',
  'tom-low': 'mid-tom',
  'tom-high': 'mid-tom',
  bass: 'kick',
};

window.airDrumStudio.hit = (name, velocity = 1) => {
  const id = aliases[name] || name;
  if (studio.getMode() !== 'play' || !['hi-hat', 'snare', 'mid-tom', 'crash', 'kick'].includes(id) || !Number.isFinite(velocity))
    return false;
  return hit(id, Math.max(0, Math.min(1, velocity)), 'external');
};
window.addEventListener('drum-hit', (event) => {
  const detail = event.detail;
  if (detail && typeof detail === 'object') window.airDrumStudio.hit(detail.drum, detail.velocity ?? 1);
});

function backend() {
  const url = new URL($('wsUrl').value);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw Error('Use a ws:// or wss:// URL.');
  if (location.protocol === 'https:' && url.protocol !== 'wss:') throw Error('A hosted HTTPS page needs a secure wss:// backend.');
  socket = new WebSocket(url);
  const ws = socket;
  status('Connecting to backend…');
  const seen = new Set();
  ws.onopen = () => status('Backend connected · waiting for drum_hit events');
  ws.onmessage = (e) => {
    try {
      if (typeof e.data !== 'string' || e.data.length > 8192) return;
      const m = JSON.parse(e.data);
      if (m.type !== 'drum_hit' || studio.getMode() !== 'play') return;
      const id = aliases[m.drum] || m.drum;
      const velocity = m.velocity ?? 1;
      if (!['hi-hat', 'snare', 'mid-tom', 'crash', 'kick'].includes(id) || !Number.isFinite(velocity)) return;
      if (m.eventId) {
        if (seen.has(m.eventId)) return;
        seen.add(m.eventId);
        if (seen.size > 1000) seen.delete(seen.values().next().value);
      }
      hit(id, Math.max(0, Math.min(1, velocity)), 'backend');
    } catch {
      status('Ignored an invalid backend message.');
    }
  };
  ws.onerror = () => status('Backend connection failed. Check the URL and server.');
  ws.onclose = () => {
    if (socket === ws) {
      stop();
      status('Backend disconnected. Start pencil tracking to reconnect.');
    }
  };
}

function helpFor(mode) {
  if (mode === 'yellow') {
    return 'Use two classic yellow/orange pencils. Bright light, plain background. Tip dots track the graphite/eraser ends.';
  }
  if (mode === 'backend') {
    return 'Your backend supplies drum hits; this mode does not run camera tracking or send video.';
  }
  return 'Wrap one tip in bright pink/magenta tape and the other in cyan. Good light, plain background. Tip dots should sit on the pencil ends, not the middle of the tape blob.';
}

$('trackToggle').onclick = async () => {
  if (running) {
    stop();
    status('Pencil tracking stopped.');
    return;
  }
  if (loading) return;
  loading = true;
  $('trackToggle').disabled = true;
  $('inputMode').disabled = true;
  try {
    await enableSound();
    const mode = $('inputMode').value;
    if (mode === 'backend') {
      backend();
      running = true;
    } else {
      if (!$('video').srcObject) throw Error('Enable the camera first.');
      pencils.setMode(mode === 'yellow' ? 'yellow' : 'neon');
      running = true;
      raf = requestAnimationFrame(frame);
    }
    $('trackToggle').textContent = 'Stop pencil tracking';
  } catch (e) {
    stop();
    status(e.message + ' You can still test the drum buttons.');
  } finally {
    loading = false;
    $('trackToggle').disabled = false;
    $('inputMode').disabled = false;
  }
};

$('inputMode').onchange = () => {
  stop();
  const mode = $('inputMode').value;
  $('backendSettings').hidden = mode !== 'backend';
  $('markerSettings').hidden = mode === 'backend';
  $('inputHelp').textContent = helpFor(mode);
  status('Input changed. Press Start pencil tracking.');
};

$('arrange').addEventListener('click', () => detector.reset());
$('play').addEventListener('click', () => {
  $('stageHint').textContent = 'Strike down through a gold line · bounce to roll';
});

function stopMetro() {
  clearInterval(metro);
  metro = null;
  $('metro').textContent = 'Start metronome';
}

$('metro').onclick = async () => {
  if (metro) {
    stopMetro();
    return;
  }
  try {
    await enableSound();
    tempo = Math.max(40, Math.min(220, Number($('bpm').value) || 90));
    $('bpm').value = tempo;
    nextBeat = audio.context.currentTime + 0.1;
    beat = 0;
    const schedule = () => {
      while (nextBeat < audio.context.currentTime + 0.08) {
        audio.tick(nextBeat, beat % 4 === 0);
        nextBeat += 60 / tempo;
        beat++;
      }
    };
    metro = setInterval(schedule, 25);
    schedule();
    $('metro').textContent = 'Stop metronome';
  } catch (e) {
    status(e.message);
  }
};

let practiceOrigin = 0;
let practicePeriod = 0;
$('record').onclick = async () => {
  if (!recording) {
    try {
      await enableSound();
    } catch (e) {
      status(e.message);
      return;
    }
    session = [];
    sessionStart = performance.now();
    recording = true;
    practiceOrigin = metro ? nextBeat : 0;
    practicePeriod = 60 / tempo;
    $('record').textContent = 'Finish practice';
    $('bpm').disabled = true;
    $('metro').disabled = true;
    $('download').disabled = true;
    $('feedback').textContent = 'Recording… Spam rolls welcome. Timing summary appears after you finish.';
  } else {
    recording = false;
    $('record').textContent = 'Record practice';
    $('bpm').disabled = false;
    $('metro').disabled = false;
    $('download').disabled = !session.length;
    let summary = `${session.length} hits in ${((performance.now() - sessionStart) / 1000).toFixed(1)} seconds.`;
    if (session.length >= 4 && practiceOrigin) {
      const errors = session.map((h) => {
        const beats = (h.audioTime - practiceOrigin) / practicePeriod;
        return Math.abs(beats - Math.round(beats)) * practicePeriod * 1000;
      });
      const avg = errors.reduce((a, b) => a + b, 0) / errors.length;
      summary += ` Average distance to the nearest click: ${Math.round(avg)} ms. ${
        avg < 60 ? 'Tight — try a faster tempo.' : 'Slow the tempo and aim for clean rebounds.'
      }`;
    } else summary += ' Record at least four hits with the metronome on for timing feedback.';
    $('feedback').textContent = summary;
  }
};

$('download').onclick = () => {
  const blob = new Blob([JSON.stringify({ tempoBpm: tempo, hits: session }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'air-drum-session.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

window.addEventListener('pagehide', () => {
  stop();
  stopMetro();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stop();
    stopMetro();
    status('Paused while this tab is hidden. Start pencil tracking to resume.');
  }
});
