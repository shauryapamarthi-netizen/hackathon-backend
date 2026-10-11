(() => {
  // Index fingertip per hand (MediaPipe hand landmark 8). MediaPipe is capped
  // at 2 hands, so at most one tracked tap-point per hand, two at a time.
  const FINGER_TIP_LANDMARK = 8;
  const TAP_VELOCITY_THRESHOLD = 0.018; // normalized units per ms of downward motion
  const TAP_COOLDOWN_MS = 180;
  const HISTORY_SIZE = 4;

  const video = document.getElementById('video');
  const statusEl = document.getElementById('handTrackingStatus');
  const studio = window.airDrumStudio;
  if (!video || !studio) return;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  if (typeof Hands === 'undefined') {
    setStatus('◈ Hand tracking unavailable (tracking model failed to load — check your internet connection)');
    console.warn('MediaPipe Hands did not load; falling back to click/keyboard drum controls only.');
    return;
  }

  setStatus('◈ Hand tracking: enable your camera to start');

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
  });

  const handState = {};

  function getZoneAt(nx, ny) {
    const layout = studio.getLayout();
    for (const zone of layout) {
      const rx = zone.width / 2;
      const ry = zone.height / 2;
      if (!rx || !ry) continue;
      const dx = (nx - zone.x) / rx;
      const dy = (ny - zone.y) / ry;
      if (dx * dx + dy * dy <= 1) return zone.id;
    }
    return null;
  }

  let modelReady = false;

  hands.onResults((results) => {
    if (!modelReady) {
      modelReady = true;
      setStatus('◈ Hand tracking ready — point an index finger and tap a drum');
    }
    if (studio.getMode() !== 'play') return;

    const seenLabels = new Set();
    const handedness = results.multiHandedness || [];
    const landmarksList = results.multiHandLandmarks || [];

    for (let i = 0; i < landmarksList.length; i++) {
      const label = (handedness[i] && handedness[i].label) || `hand${i}`;
      seenLabels.add(label);

      const tip = landmarksList[i][FINGER_TIP_LANDMARK];
      const nx = 1 - tip.x; // the video is mirrored for display; flip to match drum-zone coordinates
      const ny = tip.y;
      const now = performance.now();

      const state = handState[label] || (handState[label] = { history: [], lastTapAt: 0 });
      state.history.push({ y: ny, t: now });
      if (state.history.length > HISTORY_SIZE) state.history.shift();

      if (state.history.length === HISTORY_SIZE) {
        const first = state.history[0];
        const last = state.history[state.history.length - 1];
        const dt = last.t - first.t;
        if (dt > 0) {
          const velocity = (last.y - first.y) / dt;
          if (velocity > TAP_VELOCITY_THRESHOLD && now - state.lastTapAt > TAP_COOLDOWN_MS) {
            const zoneId = getZoneAt(nx, ny);
            if (zoneId) {
              const strength = Math.max(0.3, Math.min(1, velocity * 25));
              studio.hit(zoneId, strength);
            }
            state.lastTapAt = now;
          }
        }
      }
    }

    Object.keys(handState).forEach((label) => {
      if (!seenLabels.has(label)) delete handState[label];
    });
  });

  let rafId = null;

  async function frameLoop() {
    if (video.readyState >= 2) {
      try {
        await hands.send({ image: video });
      } catch (err) {
        console.error('Hand tracking frame error', err);
      }
    }
    rafId = requestAnimationFrame(frameLoop);
  }

  function startTracking() {
    if (rafId != null) return;
    setStatus('◈ Hand tracking: loading model…');
    frameLoop();
  }

  function stopTracking() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    modelReady = false;
    setStatus('◈ Hand tracking off (camera disabled)');
  }

  video.addEventListener('loadedmetadata', startTracking);
  video.addEventListener('emptied', stopTracking);
})();
