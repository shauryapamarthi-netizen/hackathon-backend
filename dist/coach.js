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

  const levelBadge = document.createElement('div');
  levelBadge.id = 'levelBadge';
  levelBadge.className = 'level-badge';
  if (banner) banner.insertAdjacentElement('beforebegin', levelBadge);

  const levelUpToast = document.createElement('div');
  levelUpToast.id = 'levelUpToast';
  levelUpToast.className = 'level-up-toast';
  levelUpToast.hidden = true;
  document.body.appendChild(levelUpToast);
  let toastTimer = null;

  function renderLevelBadge(weakestSkill, level) {
    if (!levelBadge || !level) return;
    const label = (SKILL_LABELS[weakestSkill] || weakestSkill).toUpperCase();
    const pct = (level.progress / level.repsPerLevel) * 100;
    const isMax = level.level >= level.maxLevel;
    levelBadge.innerHTML = `<div class="level-badge-top"><span>LEVEL ${level.level} &middot; ${label}</span><span>${isMax ? 'MAX' : `${level.progress}/${level.repsPerLevel}`}</span></div><div class="level-track"><div class="level-fill" style="width:${isMax ? 100 : pct}%"></div></div>`;
  }

  function showLevelUpToast(skillKey, newLevel) {
    const label = SKILL_LABELS[skillKey] || skillKey;
    levelUpToast.textContent = `🎉 Level ${newLevel} unlocked — ${label}!`;
    levelUpToast.hidden = false;
    levelUpToast.classList.remove('pop');
    void levelUpToast.offsetWidth;
    levelUpToast.classList.add('pop');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { levelUpToast.hidden = true; }, 3200);
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
      renderLevelBadge(data.weakestSkill, data.level);
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
      const skillKey = currentExercise.targetSkill;
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
      if (data.leveledUp) showLevelUpToast(skillKey, data.level.level);
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

  const STREAK_COMMENTS = [
    "You're on fire! 🔥 Keep that pocket locked in.",
    "Nailing it — this is what consistent timing feels like.",
    "Smooth and steady. That's the sound of real progress.",
    "Your timing is tightening up nicely, keep going!"
  ];
  const STRUGGLE_COMMENTS = [
    "No worries, timing takes reps. Slow the tempo down a notch and try again.",
    "Close! Try counting out loud with the click to re-sync.",
    "Everyone drifts off-beat sometimes — reset and focus on the very next hit.",
    "Take a breath, drop the tempo 10 BPM, and lock back in."
  ];
  let commentPoolIndex = 0;

  function setupLiveFeedback() {
    const audio = window.drumAudio;
    const studio = window.airDrumStudio;
    if (!audio || !studio || typeof studio.hit !== 'function' || typeof audio.tick !== 'function') return;

    const ON_BEAT_MS = 40;
    const CLOSE_MS = 90;
    const COMMENT_EVERY = 6;

    const liveEl = document.createElement('div');
    liveEl.id = 'liveFeedback';
    liveEl.className = 'live-feedback';
    liveEl.textContent = 'Live feedback appears here as you play.';
    if (banner) banner.insertAdjacentElement('afterend', liveEl);

    let lastTickWhen = null;
    let tickPeriod = null;
    const originalTick = audio.tick.bind(audio);
    audio.tick = (when, accent) => {
      if (lastTickWhen != null) {
        const delta = when - lastTickWhen;
        if (delta > 0.05 && delta < 3) tickPeriod = delta;
      }
      lastTickWhen = when;
      return originalTick(when, accent);
    };

    let hitStreak = 0;
    let hitsSinceComment = 0;
    let goodSinceComment = 0;
    const originalHit = studio.hit.bind(studio);
    studio.hit = (name, velocity) => {
      const played = originalHit(name, velocity);
      if (!played) return played;

      if (lastTickWhen == null || !tickPeriod || !audio.context) {
        liveEl.textContent = `🥁 ${name} hit! Start the metronome for live timing feedback.`;
        return played;
      }

      const now = audio.context.currentTime;
      const beatsSinceTick = (now - lastTickWhen) / tickPeriod;
      const offsetMs = (beatsSinceTick - Math.round(beatsSinceTick)) * tickPeriod * 1000;
      const absMs = Math.abs(offsetMs);
      const wasGood = absMs < CLOSE_MS;

      let text;
      if (absMs < ON_BEAT_MS) {
        hitStreak++;
        text = `🎯 ${name} — right on the beat!`;
      } else if (absMs < CLOSE_MS) {
        hitStreak++;
        text = `👍 ${name} — close, a touch ${offsetMs > 0 ? 'late' : 'early'}`;
      } else {
        hitStreak = 0;
        text = `⏱ ${name} — ${offsetMs > 0 ? 'rushing late' : 'a bit early'}, aim closer to the click`;
      }
      if (hitStreak >= 5) text += ` (${hitStreak} in a row!)`;
      liveEl.textContent = text;

      hitsSinceComment++;
      if (wasGood) goodSinceComment++;
      if (hitsSinceComment >= COMMENT_EVERY) {
        const pool = goodSinceComment / hitsSinceComment >= 0.6 ? STREAK_COMMENTS : STRUGGLE_COMMENTS;
        appendMessage('assistant', pool[commentPoolIndex % pool.length]);
        commentPoolIndex++;
        hitsSinceComment = 0;
        goodSinceComment = 0;
      }

      return played;
    };
  }
  setupLiveFeedback();
})();
