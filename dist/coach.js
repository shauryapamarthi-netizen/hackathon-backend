import './performance.js';
(() => {
  function getUserId() {
    let id = localStorage.getItem('airDrumUserId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('airDrumUserId', id);
    }
    return id;
  }

  const userId = getUserId();
  let currentExercise = null;
  let lastCoachContext = null;

  const banner = document.getElementById('coachBanner');
  const feedbackEl = document.getElementById('feedback');
  const bpmInput = document.getElementById('bpm');

  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatStatus = document.getElementById('chatStatus');
  const history = [];

  function appendMessage(role, text) {
    if (!chatMessages) return;
    const el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.textContent = text;
    chatMessages.appendChild(el);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderBanner(data, feedbackText) {
    if (!banner) return;
    banner.classList.add('visible');
    const ex = data.exercise;
    banner.innerHTML = `<strong>Coach suggests:</strong> ${ex.title} &mdash; focus on <strong>${data.weakestSkill.replace('_', ' ')}</strong> around ${ex.tempoBpm} BPM.` +
      (feedbackText ? `<div class="coach-feedback">${feedbackText}</div>` : '');
  }

  const SKILL_LABELS = {
    pitch_accuracy: 'Accuracy',
    rhythm_accuracy: 'Rhythm',
    timing: 'Timing',
    interval_accuracy: 'Spacing'
  };

  const insightsTop = document.getElementById('insightsTop');
  const insightsSkills = document.getElementById('insightsSkills');

  function renderInsightSkills(skillAverages) {
    if (!insightsSkills || !skillAverages) return;
    insightsSkills.innerHTML = Object.entries(SKILL_LABELS).map(([key, label]) => {
      const value = skillAverages[key];
      const pct = value == null ? 0 : Math.max(2, Math.min(100, value));
      const display = value == null ? 'not tried yet' : `${value.toFixed(0)}/100`;
      return `<div class="skill-row"><span class="skill-label">${label}</span><div class="skill-track"><div class="skill-fill" style="width:${pct}%"></div></div><span class="skill-value">${display}</span></div>`;
    }).join('');
  }

  async function refreshInsightsTop() {
    if (!insightsTop) return;
    try {
      const res = await fetch('/exercises');
      if (!res.ok) return;
      const exercises = await res.json();
      const tried = exercises.filter((ex) => ex.stats && ex.stats.timesPlayed > 0);
      if (tried.length === 0) {
        insightsTop.textContent = 'Be the first to play — we\'ll learn which patterns help the most.';
        return;
      }
      const best = tried.reduce((a, b) => (b.stats.avgImprovement > a.stats.avgImprovement ? b : a));
      const sign = best.stats.avgImprovement >= 0 ? '+' : '';
      insightsTop.innerHTML = `<span class="insights-trophy">🏆</span> <strong>${best.title}</strong> is helping players improve the most (${sign}${best.stats.avgImprovement.toFixed(1)} avg, across ${best.stats.timesPlayed} ${best.stats.timesPlayed === 1 ? 'play' : 'plays'})`;
    } catch (err) {
      console.error('Could not load insights', err);
    }
  }

  async function loadNextExercise(feedbackText) {
    try {
      const res = await fetch(`/next-exercise?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      currentExercise = data.exercise;
      lastCoachContext = { weakestSkill: data.weakestSkill, skillAverages: data.skillAverages };
      renderBanner(data, feedbackText);
      renderInsightSkills(data.skillAverages);
      refreshInsightsTop();
      if (bpmInput && currentExercise.tempoBpm) {
        bpmInput.value = currentExercise.tempoBpm;
      }
    } catch (err) {
      console.error('Could not load next exercise', err);
    }
  }

  async function submitAttempt(rhythmAccuracy) {
    if (!currentExercise) return;
    try {
      const res = await fetch('/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          exerciseId: currentExercise._id,
          pitchAccuracy: rhythmAccuracy,
          rhythmAccuracy
        })
      });
      const data = await res.json();
      appendMessage('assistant', data.feedback);
      await loadNextExercise(data.feedback);
    } catch (err) {
      console.error('Could not submit attempt', err);
    }
  }

  if (feedbackEl) {
    let lastSeenText = feedbackEl.textContent;
    const observer = new MutationObserver(() => {
      const text = feedbackEl.textContent;
      if (text === lastSeenText) return;
      lastSeenText = text;
      const match = text.match(/^(\d+) hits in ([\d.]+) seconds\.(?: Average distance to the nearest click: (\d+) ms\.)?/);
      if (!match) return;
      const hitCount = parseInt(match[1], 10);
      if (hitCount < 1) return;
      const avgMs = match[3] ? parseInt(match[3], 10) : null;
      const rhythmAccuracy = avgMs == null ? 55 : Math.max(0, Math.min(100, 100 - avgMs / 3));
      submitAttempt(rhythmAccuracy);
    });
    observer.observe(feedbackEl, { childList: true, characterData: true, subtree: true });
  }

  loadNextExercise();

  function setupGettingStarted() {
    const ids = ['step-camera', 'step-play', 'step-sound', 'step-hit'];
    const steps = ids.map((id) => document.getElementById(id));
    if (steps.some((s) => !s)) return;

    function updateActive() {
      const firstNotDone = steps.find((s) => !s.classList.contains('done'));
      steps.forEach((s) => s.classList.remove('active'));
      if (firstNotDone) firstNotDone.classList.add('active');
    }

    function markDone(step) {
      if (!step || step.classList.contains('done')) return;
      step.classList.add('done');
      updateActive();
    }

    function watchText(el, test, onMatch) {
      if (!el) return;
      const check = () => { if (test(el.textContent)) onMatch(); };
      check();
      new MutationObserver(check).observe(el, { childList: true, characterData: true, subtree: true });
    }

    updateActive();
    watchText(document.getElementById('cameraStatus'), (t) => /live/i.test(t), () => markDone(steps[0]));
    watchText(document.getElementById('modeCaption'), (t) => /play/i.test(t), () => markDone(steps[1]));
    watchText(document.getElementById('soundOn'), (t) => /enabled/i.test(t), () => markDone(steps[2]));
    watchText(document.getElementById('hitCount'), (t) => !/^0 hits/.test(t), () => markDone(steps[3]));
  }
  setupGettingStarted();

  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function updateFullscreenLabel() {
      fullscreenBtn.textContent = isFullscreen() ? '⤡ Exit full screen' : '⛶ Full screen';
    }
    fullscreenBtn.addEventListener('click', () => {
      const root = document.documentElement;
      if (!isFullscreen()) {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) request.call(root);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    });
    document.addEventListener('fullscreenchange', updateFullscreenLabel);
    document.addEventListener('webkitfullscreenchange', updateFullscreenLabel);
    updateFullscreenLabel();
  }

  appendMessage('assistant', "Hi! I'm your drum coach. Ask me how to hold a steady beat, which drum to hit first, how to warm up, or say \"teach me a song\" for a pattern to practice — and I'll chime in on my own after each practice round.");

  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      appendMessage('user', text);
      history.push({ role: 'user', content: text });
      chatInput.value = '';
      chatInput.disabled = true;
      chatStatus.textContent = 'Thinking...';

      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history, context: lastCoachContext })
        });
        const data = await res.json();
        appendMessage('assistant', data.reply);
        history.push({ role: 'assistant', content: data.reply });
      } catch (err) {
        appendMessage('assistant', "Sorry, I couldn't reach the coach right now.");
      } finally {
        chatInput.disabled = false;
        chatStatus.textContent = '';
        chatInput.focus();
      }
    });
  }
})();
