const Anthropic = require('@anthropic-ai/sdk');

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
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
  const anthropic = getClient();
  if (!anthropic) {
    return fallbackFeedback({ overallScore, improvement });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `A music student just practiced an exercise targeting "${targetSkill}". Pitch accuracy: ${pitchAccuracy}/100, rhythm accuracy: ${rhythmAccuracy}/100, overall score: ${overallScore.toFixed(1)}/100, improvement since their last attempt on this skill: ${improvement.toFixed(1)}. Give 2 short, encouraging sentences of feedback plus one concrete tip for what to focus on next. Keep it under 40 words total, no markdown.`
      }]
    });
    return message.content[0].text;
  } catch (err) {
    console.error('Claude API error:', err.message);
    return fallbackFeedback({ overallScore, improvement });
  }
}

const CHAT_SYSTEM_PROMPT = 'You are a friendly, encouraging drum teacher helping a beginner learn to play an air-drum kit (hi-hat, snare, mid-tom, crash, kick) using hand tracking or the A/S/D/F/Space keys. Give short, practical, beginner-friendly answers, 2-4 sentences unless asked for more detail. Focus on rhythm, timing, posture, and building confidence.';

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
  const anthropic = getClient();
  if (!anthropic) {
    return fallbackChatReply(messages, context);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: CHAT_SYSTEM_PROMPT + describeContext(context),
      messages
    });
    return response.content[0].text;
  } catch (err) {
    console.error('Claude chat error:', err.message);
    return fallbackChatReply(messages, context);
  }
}

module.exports = { generateFeedback, generateChatReply };
