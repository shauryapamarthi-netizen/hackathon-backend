const SkillHistory = require('../models/SkillHistory');
const Exercise = require('../models/Exercise');

const ALL_SKILLS = ['pitch_accuracy', 'rhythm_accuracy', 'timing', 'interval_accuracy'];

async function getSkillAverages(userId) {
  const history = await SkillHistory.find({ userId });
  const averages = {};
  for (const skill of ALL_SKILLS) {
    const entries = history.filter((h) => h.skill === skill);
    if (entries.length === 0) {
      averages[skill] = null;
    } else {
      averages[skill] = entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
    }
  }
  return averages;
}

function pickWeakestSkill(averages) {
  const neverTried = Object.entries(averages).find(([, v]) => v === null);
  if (neverTried) return neverTried[0];
  return Object.entries(averages).sort((a, b) => a[1] - b[1])[0][0];
}

async function pickNextExercise(userId) {
  const averages = await getSkillAverages(userId);
  const weakestSkill = pickWeakestSkill(averages);

  const candidates = await Exercise.find({ targetSkill: weakestSkill });
  if (candidates.length === 0) {
    return { exercise: null, weakestSkill, skillAverages: averages };
  }

  candidates.sort((a, b) => b.stats.avgImprovement - a.stats.avgImprovement);
  return { exercise: candidates[0], weakestSkill, skillAverages: averages };
}

module.exports = { pickNextExercise, getSkillAverages, ALL_SKILLS };
