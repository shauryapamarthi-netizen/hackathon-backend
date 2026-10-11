function getUserId() {
  let id = localStorage.getItem('practiceUserId');
  if (!id) {
    id = 'user_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('practiceUserId', id);
  }
  return id;
}

const userId = getUserId();

function buildNoteFrequencyTable() {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const table = {};
  for (let octave = 0; octave <= 8; octave++) {
    for (let i = 0; i < names.length; i++) {
      const midi = (octave + 1) * 12 + i;
      table[names[i] + octave] = 440 * Math.pow(2, (midi - 69) / 12);
    }
  }
  return table;
}

const NOTE_FREQUENCIES = buildNoteFrequencyTable();

function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0;
  let r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  if (newSize < 2) return -1;

  const c = new Array(newSize).fill(0);
  for (let lag = 0; lag < newSize; lag++) {
    for (let i = 0; i < newSize - lag; i++) {
      c[lag] += trimmed[i] * trimmed[i + lag];
    }
  }

  let d = 0;
  while (d < newSize - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  let T0 = maxPos;
  if (T0 > 0 && T0 < newSize - 1) {
    const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);
  }
  if (!T0) return -1;
  return sampleRate / T0;
}

let audioContext = null;
let analyser = null;
let currentExercise = null;

const elExerciseInfo = document.getElementById('exercise-info');
const elNotesList = document.getElementById('notes-list');
const elDemoBtn = document.getElementById('demo-btn');
const elStartBtn = document.getElementById('start-btn');
const elProgressFill = document.getElementById('progress-fill');
const elStatus = document.getElementById('status');
const elResultCard = document.getElementById('result-card');
const elResultScore = document.getElementById('result-score');
const elFeedbackText = document.getElementById('feedback-text');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadNextExercise() {
  elStatus.textContent = '';
  elResultCard.style.display = 'none';
  const res = await fetch(`/next-exercise?userId=${userId}`);
  if (!res.ok) {
    elExerciseInfo.textContent = 'Could not load an exercise. Is the server running?';
    return;
  }
  const data = await res.json();
  currentExercise = data.exercise;
  renderExercise(data);
}

function renderExercise(data) {
  const ex = data.exercise;
  elExerciseInfo.innerHTML = `<strong>${ex.title}</strong><br/>
    <span class="skill-tag">targeting: ${data.weakestSkill.replace('_', ' ')}</span>
    <span class="skill-tag">difficulty ${ex.difficulty}</span>
    <span class="skill-tag">${ex.tempoBpm} BPM</span>`;
  elNotesList.textContent = ex.notes.map((n) => n.pitch).join('  -  ');
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function playDemo() {
  const ctx = getAudioContext();
  const beatDurationSec = 60 / currentExercise.tempoBpm;
  elStatus.textContent = 'Playing demo...';

  for (const note of currentExercise.notes) {
    const freq = NOTE_FREQUENCIES[note.pitch];
    const startAt = ctx.currentTime + note.startBeat * beatDurationSec;
    const duration = note.durationBeats * beatDurationSec * 0.9;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.05);
  }

  const totalDuration = Math.max(...currentExercise.notes.map((n) => n.startBeat + n.durationBeats)) * beatDurationSec;
  await sleep(totalDuration * 1000 + 200);
  elStatus.textContent = '';
}

async function ensureMic() {
  if (analyser) return;
  const ctx = getAudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = ctx.createMediaStreamSource(stream);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
}

function scoreAttempt(notes, beatDurationSec, samples) {
  const pitchScores = [];
  const rhythmScores = [];

  for (const note of notes) {
    const expectedStart = note.startBeat * beatDurationSec;
    const expectedEnd = (note.startBeat + note.durationBeats) * beatDurationSec;
    const windowSamples = samples.filter((s) => s.time >= expectedStart && s.time <= expectedEnd && s.freq > 0);

    if (windowSamples.length === 0) {
      pitchScores.push(0);
      rhythmScores.push(0);
      continue;
    }

    const freqs = windowSamples.map((s) => s.freq).sort((a, b) => a - b);
    const medianFreq = freqs[Math.floor(freqs.length / 2)];
    const expectedFreq = NOTE_FREQUENCIES[note.pitch];
    const centsOff = Math.abs(1200 * Math.log2(medianFreq / expectedFreq));
    pitchScores.push(Math.max(0, 100 - centsOff / 2));

    const firstDetectedTime = windowSamples[0].time;
    const timingError = Math.abs(firstDetectedTime - expectedStart);
    rhythmScores.push(Math.max(0, 100 - (timingError / beatDurationSec) * 100));
  }

  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return { pitchAccuracy: avg(pitchScores), rhythmAccuracy: avg(rhythmScores) };
}

async function startPractice() {
  elStartBtn.disabled = true;
  elDemoBtn.disabled = true;
  try {
    elStatus.textContent = 'Requesting microphone access...';
    await ensureMic();

    const ctx = getAudioContext();
    const beatDurationSec = 60 / currentExercise.tempoBpm;
    const totalDurationSec = Math.max(...currentExercise.notes.map((n) => n.startBeat + n.durationBeats)) * beatDurationSec;

    const buf = new Float32Array(analyser.fftSize);
    const samples = [];
    const startTime = ctx.currentTime;

    elStatus.textContent = 'Listening... play the exercise now!';
    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      const freq = autoCorrelate(buf, ctx.sampleRate);
      const elapsed = ctx.currentTime - startTime;
      samples.push({ time: elapsed, freq });
      const pct = Math.min(100, (elapsed / totalDurationSec) * 100);
      elProgressFill.style.width = pct + '%';
    }, 50);

    await sleep(totalDurationSec * 1000 + 300);
    clearInterval(interval);
    elProgressFill.style.width = '100%';

    elStatus.textContent = 'Scoring your attempt...';
    const { pitchAccuracy, rhythmAccuracy } = scoreAttempt(currentExercise.notes, beatDurationSec, samples);

    const res = await fetch('/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        exerciseId: currentExercise._id,
        pitchAccuracy,
        rhythmAccuracy
      })
    });
    const data = await res.json();

    elResultCard.style.display = 'block';
    elResultScore.textContent = `${data.attempt.overallScore.toFixed(0)} / 100`;
    elFeedbackText.textContent = data.feedback;
    elStatus.textContent = '';
    elProgressFill.style.width = '0%';

    await loadNextExercise();
  } catch (err) {
    console.error(err);
    elStatus.textContent = 'Error: ' + err.message + ' (microphone access may have been denied)';
  } finally {
    elStartBtn.disabled = false;
    elDemoBtn.disabled = false;
  }
}

elDemoBtn.addEventListener('click', playDemo);
elStartBtn.addEventListener('click', startPractice);

loadNextExercise();
