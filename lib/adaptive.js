const SkillHistory = require('../models/SkillHistory');
const Exercise = require('../models/Exercise');

const ALL_SKILLS = ['pitch_accuracy', 'rhythm_accuracy', 'timing', 'interval_accuracy'];

const MAX_LEVEL = 3;
const REPS_PER_LEVEL = 3;
const PASS_SCORE = 70;

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

async function getSkillLevel(userId, skill) {
  const passedCount = await SkillHistory.countDocuments({ userId, skill, score: { $gte: PASS_SCORE } });
  const level = Math.min(MAX_LEVEL, 1 + Math.floor(passedCount / REPS_PER_LEVEL));
  const progress = level >= MAX_LEVEL ? REPS_PER_LEVEL : passedCount % REPS_PER_LEVEL;
  return { level, progress, repsPerLevel: REPS_PER_LEVEL, maxLevel: MAX_LEVEL, passedCount };
}

async function pickNextExercise(userId) {
  const averages = await getSkillAverages(userId);
  const weakestSkill = pickWeakestSkill(averages);
  const levelInfo = await getSkillLevel(userId, weakestSkill);

  const candidates = await Exercise.find({ targetSkill: weakestSkill, difficulty: { $lte: levelInfo.level } });
  const pool = candidates.length === 0
    ? await Exercise.find({ targetSkill: weakestSkill })
    : candidates;

  if (pool.length === 0) {
    return { exercise: null, weakestSkill, skillAverages: averages, level: levelInfo };
  }

  const atCurrentLevel = pool.filter((c) => c.difficulty === levelInfo.level);
  const chosenFrom = atCurrentLevel.length > 0 ? atCurrentLevel : pool;
  chosenFrom.sort((a, b) => b.stats.avgImprovement - a.stats.avgImprovement);

  return { exercise: chosenFrom[0], weakestSkill, skillAverages: averages, level: levelInfo };
}

module.exports = { pickNextExercise, getSkillAverages, getSkillLevel, ALL_SKILLS };
