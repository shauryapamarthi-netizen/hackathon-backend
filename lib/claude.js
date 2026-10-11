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

const FALLBACK_CHAT_TIPS = [
  "Here's a quick tip: rest your hands loosely and let them bounce off each drum zone instead of punching down hard. Start at a slow tempo with the metronome before speeding up.",
  "Try hitting the kick and snare on alternating beats first (kick on 1 and 3, snare on 2 and 4) before adding the hi-hat on top.",
  "Keep your eyes on the screen's drum zones, not your hands, and let muscle memory take over as you repeat the pattern.",
  "If your timing feels off, slow the metronome down until every hit lands close to the click, then gradually speed up."
];

function fallbackChatReply(messages) {
  const idx = messages.length % FALLBACK_CHAT_TIPS.length;
  return FALLBACK_CHAT_TIPS[idx] + ' (Add an ANTHROPIC_API_KEY to .env for full AI coaching.)';
}

async function generateChatReply(messages) {
  const anthropic = getClient();
  if (!anthropic) {
    return fallbackChatReply(messages);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: CHAT_SYSTEM_PROMPT,
      messages
    });
    return response.content[0].text;
  } catch (err) {
    console.error('Claude chat error:', err.message);
    return fallbackChatReply(messages);
  }
}

module.exports = { generateFeedback, generateChatReply };
