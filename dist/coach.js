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

  async function loadNextExercise(feedbackText) {
    try {
      const res = await fetch(`/next-exercise?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      currentExercise = data.exercise;
      lastCoachContext = { weakestSkill: data.weakestSkill, skillAverages: data.skillAverages };
      renderBanner(data, feedbackText);
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

  appendMessage('assistant', "Hi! I'm your drum coach. Ask me how to hold a steady beat, which drum to hit first, or how to warm up — and I'll chime in on my own after each practice round.");

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
