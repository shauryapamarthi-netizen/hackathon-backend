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

module.exports = { generateFeedback };
