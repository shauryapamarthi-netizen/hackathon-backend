const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const LUMINAL_BASE_URL = 'https://flash.luminal.cloud/v1';
const LUMINAL_MODEL = 'deepseek-ai/DeepSeek-V4.1-Flash';

async function callLuminal(systemPrompt, messages, maxTokens) {
  const apiKey = process.env.LUMINAL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(`${LUMINAL_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: LUMINAL_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Luminal API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  if (!content) {
    throw new Error('Luminal returned no content (likely ran out of tokens on reasoning before answering)');
  }
  return content;
}

function fallbackFeedback({ overallScore, improvement }) {
  if (improvement > 0) {
    return `Nice work, you improved by ${improvement.toFixed(1)} points! Score: ${overallScore.toFixed(1)}/100. Keep practicing at this tempo before speeding up.`;
  }
  if (overallScore >= 80) {
    return `Great job, scored ${overallScore.toFixed(1)}/100! Try a harder exercise next.`;
  }
  return `Scored ${overallScore.toFixed(1)}/100. Focus on steady tempo and listen closely to pitch before replaying.`;
}

async function generateFeedback({ targetSkill, pitchAccuracy, rhythmAccuracy, overallScore, improvement }) {
  const userPrompt = `A music student just practiced an exercise targeting "${targetSkill}". Pitch accuracy: ${pitchAccuracy}/100, rhythm accuracy: ${rhythmAccuracy}/100, overall score: ${overallScore.toFixed(1)}/100, improvement since their last attempt on this skill: ${improvement.toFixed(1)}. Give 2 short, encouraging sentences of feedback plus one concrete tip for what to focus on next. Keep it under 40 words total, no markdown.`;

  try {
    const luminalReply = await callLuminal('You are an encouraging music practice coach. Keep replies very short.', [{ role: 'user', content: userPrompt }], 700);
    if (luminalReply) return luminalReply;
  } catch (err) {
    console.error('Luminal API error:', err.message);
  }

  const anthropic = getClient();
  if (!anthropic) {
    return fallbackFeedback({ overallScore, improvement });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: userPrompt }]
    });
    return message.content[0].text;
  } catch (err) {
    console.error('Claude API error:', err.message);
    return fallbackFeedback({ overallScore, improvement });
  }
}

const CHAT_SYSTEM_PROMPT = 'You are a friendly, encouraging drum teacher helping a beginner learn to play an air-drum kit (only five zones: hi-hat, snare, mid-tom, crash, kick) using hand tracking or the A/S/D/F/Space keys. Give short, practical, beginner-friendly answers, 2-4 sentences unless asked for more detail. Focus on rhythm, timing, posture, and building confidence. When asked to teach a specific named song, actually use that song: identify its real tempo and genre/feel from what you know, then describe a simplified beginner practice pattern "in the style of" it using only the five available drum names plus a BPM to set the metronome to — make clear it is a simplified practice pattern, not an exact transcription, since this kit only has five zones. If you are not confident what the song actually sounds like, say so honestly and offer the closest well-known groove instead of guessing. When asked for a beat with no song named, pick any well-known simple groove (basic rock beat, four-on-the-floor, shuffle, etc).';

const SONG_PATTERNS = [
  { name: 'Basic rock beat', bpm: 92, pattern: 'kick, hi-hat, snare, hi-hat — repeat, with hi-hat on every beat and kick/snare alternating' },
  { name: 'Four-on-the-floor', bpm: 120, pattern: 'kick on every beat, hi-hat on the off-beats in between each kick' },
  { name: 'Simple shuffle', bpm: 80, pattern: 'kick, hi-hat hi-hat, snare, hi-hat hi-hat — give the hi-hat pairs a swung, uneven feel' },
  { name: 'Half-time groove', bpm: 70, pattern: 'kick on beat 1, snare on beat 3 only, hi-hat steady on every beat in between' }
];

function isSongRequest(text) {
  return /\b(song|teach me|pattern|groove|beat to play|learn a (beat|rhythm))\b/i.test(text || '');
}

function extractSongName(text) {
  const quoted = (text || '').match(/["'“]([^"'”]{2,60})["'”]/);
  if (quoted) return quoted[1];
  const named = (text || '').match(/(?:teach me|play|learn)\s+(?:the\s+)?(?:song\s+)?(?:how to play\s+)?["']?([A-Z][\w' -]{2,40})/);
  if (named) return named[1].trim();
  return null;
}

function fallbackSongReply(messages) {
  const pick = SONG_PATTERNS[messages.length % SONG_PATTERNS.length];
  const songName = extractSongName(lastUserMessage(messages));
  const intro = songName
    ? `No AI key hooked up right now, so I can't pull up "${songName}" specifically — but here's a similar-feeling groove to practice:`
    : 'Try this:';
  return `${intro} "${pick.name}" at ${pick.bpm} BPM: ${pick.pattern}. Set the practice tempo to ${pick.bpm}, turn on the metronome, and loop it slowly a few times before speeding up.`;
}

function lastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || '';
  }
  return '';
}

const SKILL_FALLBACK_TIPS = {
  pitch_accuracy: "Your control over individual hits could use some work. Focus on hitting the exact center of each drum zone every time instead of varying your aim, so your sound stays consistent.",
  rhythm_accuracy: "Rhythm is your weakest spot right now. Slow the metronome down until every hit lands close to the click, then gradually speed up once it feels automatic.",
  timing: "Work on timing next: try closing your eyes and playing along with just the metronome for a few bars, so you're listening instead of watching for cues.",
  interval_accuracy: "Focus on spacing between hits: practice switching cleanly between two drums (like snare and hi-hat) at a slow, even tempo before mixing in more."
};

const GENERIC_FALLBACK_TIPS = [
  "Here's a quick tip: rest your hands loosely and let them bounce off each drum zone instead of punching down hard. Start at a slow tempo with the metronome before speeding up.",
  "Try hitting the kick and snare on alternating beats first (kick on 1 and 3, snare on 2 and 4) before adding the hi-hat on top.",
  "Keep your eyes on the screen's drum zones, not your hands, and let muscle memory take over as you repeat the pattern.",
  "If your timing feels off, slow the metronome down until every hit lands close to the click, then gradually speed up."
];

function fallbackChatReply(messages, context) {
  if (isSongRequest(lastUserMessage(messages))) {
    return fallbackSongReply(messages);
  }
  let tip;
  if (context && context.weakestSkill && SKILL_FALLBACK_TIPS[context.weakestSkill]) {
    tip = SKILL_FALLBACK_TIPS[context.weakestSkill];
  } else {
    tip = GENERIC_FALLBACK_TIPS[messages.length % GENERIC_FALLBACK_TIPS.length];
  }
  return tip + ' (Add an ANTHROPIC_API_KEY to .env for full AI coaching.)';
}

function describeContext(context) {
  if (!context || !context.weakestSkill) return '';
  const parts = [`The player's current weakest skill is "${context.weakestSkill.replace('_', ' ')}".`];
  if (context.skillAverages) {
    const known = Object.entries(context.skillAverages)
      .filter(([, v]) => v != null)
      .map(([skill, v]) => `${skill.replace('_', ' ')}: ${v.toFixed(0)}/100`);
    if (known.length) parts.push(`Recent skill averages — ${known.join(', ')}.`);
  }
  parts.push('Tailor your answer toward improving their weakest skill when relevant.');
  return ' ' + parts.join(' ');
}

async function generateChatReply(messages, context) {
  const systemPrompt = CHAT_SYSTEM_PROMPT + describeContext(context);

  try {
    const luminalReply = await callLuminal(systemPrompt, messages, 1200);
    if (luminalReply) return luminalReply;
  } catch (err) {
    console.error('Luminal chat error:', err.message);
  }

  const anthropic = getClient();
  if (!anthropic) {
    return fallbackChatReply(messages, context);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages
    });
    return response.content[0].text;
  } catch (err) {
    console.error('Claude chat error:', err.message);
    return fallbackChatReply(messages, context);
  }
}

module.exports = { generateFeedback, generateChatReply };
