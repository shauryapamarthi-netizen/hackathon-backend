const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('../config/db');
const Exercise = require('../models/Exercise');
const Attempt = require('../models/Attempt');
const SkillHistory = require('../models/SkillHistory');
const { pickNextExercise, getSkillLevel } = require('./adaptive');
const { generateFeedback, generateChatReply } = require('./claude');

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

const SEED_EXERCISES = [
  {
    title: 'Steady kick warm-up',
    targetSkill: 'timing',
    difficulty: 1,
    tempoBpm: 70,
    notes: [
      { pitch: 'kick', startBeat: 0, durationBeats: 1 },
      { pitch: 'kick', startBeat: 1, durationBeats: 1 },
      { pitch: 'kick', startBeat: 2, durationBeats: 1 },
      { pitch: 'kick', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Basic rock beat',
    targetSkill: 'timing',
    difficulty: 2,
    tempoBpm: 92,
    notes: [
      { pitch: 'kick', startBeat: 0, durationBeats: 1 },
      { pitch: 'hi-hat', startBeat: 1, durationBeats: 1 },
      { pitch: 'snare', startBeat: 2, durationBeats: 1 },
      { pitch: 'hi-hat', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Four-on-the-floor',
    targetSkill: 'rhythm_accuracy',
    difficulty: 2,
    tempoBpm: 120,
    notes: [
      { pitch: 'kick', startBeat: 0, durationBeats: 0.5 },
      { pitch: 'kick', startBeat: 0.5, durationBeats: 0.5 },
      { pitch: 'kick', startBeat: 1, durationBeats: 0.5 },
      { pitch: 'kick', startBeat: 1.5, durationBeats: 0.5 }
    ]
  },
  {
    title: 'Syncopated snare drill',
    targetSkill: 'rhythm_accuracy',
    difficulty: 3,
    tempoBpm: 100,
    notes: [
      { pitch: 'snare', startBeat: 0, durationBeats: 0.5 },
      { pitch: 'snare', startBeat: 0.75, durationBeats: 0.25 },
      { pitch: 'snare', startBeat: 1.5, durationBeats: 0.5 },
      { pitch: 'snare', startBeat: 2.5, durationBeats: 1 }
    ]
  },
  {
    title: 'Hi-hat / snare alternation',
    targetSkill: 'interval_accuracy',
    difficulty: 2,
    tempoBpm: 80,
    notes: [
      { pitch: 'hi-hat', startBeat: 0, durationBeats: 1 },
      { pitch: 'snare', startBeat: 1, durationBeats: 1 },
      { pitch: 'hi-hat', startBeat: 2, durationBeats: 1 },
      { pitch: 'snare', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Crash accent drill',
    targetSkill: 'pitch_accuracy',
    difficulty: 1,
    tempoBpm: 60,
    notes: [
      { pitch: 'kick', startBeat: 0, durationBeats: 1 },
      { pitch: 'crash', startBeat: 1, durationBeats: 1 },
      { pitch: 'kick', startBeat: 2, durationBeats: 1 },
      { pitch: 'crash', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Full kit round robin',
    targetSkill: 'pitch_accuracy',
    difficulty: 2,
    tempoBpm: 70,
    notes: [
      { pitch: 'kick', startBeat: 0, durationBeats: 1 },
      { pitch: 'snare', startBeat: 1, durationBeats: 1 },
      { pitch: 'hi-hat', startBeat: 2, durationBeats: 1 },
      { pitch: 'mid-tom', startBeat: 3, durationBeats: 1 }
    ]
  }
];

let cachedApp = null;

async function createApp({ serveStatic = false } = {}) {
  if (cachedApp) return cachedApp;

  await connectDB();

  const hasCurrentSeed = await Exercise.exists({ title: SEED_EXERCISES[0].title });
  if (!hasCurrentSeed) {
    await Exercise.deleteMany({});
    await Exercise.insertMany(SEED_EXERCISES);
    console.log(`Seeded ${SEED_EXERCISES.length} drum exercises`);
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));

  if (serveStatic) {
    app.use(express.static(path.join(__dirname, '..', 'dist')));
    app.use('/simple', express.static(path.join(__dirname, '..', 'public')));
  }

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.get('/exercises', async (req, res) => {
    const exercises = await Exercise.find();
    res.json(exercises);
  });

  app.get('/next-exercise', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId query param is required' });
    }

    const { exercise, weakestSkill, skillAverages, level } = await pickNextExercise(userId);
    if (!exercise) {
      return res.status(404).json({ error: `No exercises found for skill ${weakestSkill}` });
    }

    res.json({ exercise, weakestSkill, skillAverages, level });
  });

  app.post('/attempts', async (req, res) => {
    const { userId, exerciseId } = req.body;
    const pitchAccuracy = clampScore(req.body.pitchAccuracy);
    const rhythmAccuracy = clampScore(req.body.rhythmAccuracy);
    if (!userId || !exerciseId || pitchAccuracy == null || rhythmAccuracy == null) {
      return res.status(400).json({
        error: 'userId, exerciseId, and numeric pitchAccuracy/rhythmAccuracy (0-100) are required'
      });
    }
    if (!mongoose.Types.ObjectId.isValid(exerciseId)) {
      return res.status(400).json({ error: 'exerciseId is not a valid id' });
    }

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const overallScore = (pitchAccuracy + rhythmAccuracy) / 2;

    const lastSkillEntry = await SkillHistory.findOne({ userId, skill: exercise.targetSkill })
      .sort({ recordedAt: -1 });
    const improvement = lastSkillEntry ? overallScore - lastSkillEntry.score : 0;

    const levelBefore = await getSkillLevel(userId, exercise.targetSkill);

    const attempt = await Attempt.create({
      userId,
      exerciseId,
      pitchAccuracy,
      rhythmAccuracy,
      overallScore,
      improvement
    });

    await SkillHistory.create({ userId, skill: exercise.targetSkill, score: overallScore });

    const levelAfter = await getSkillLevel(userId, exercise.targetSkill);

    exercise.stats.timesPlayed += 1;
    exercise.stats.totalImprovement += improvement;
    exercise.stats.avgImprovement = exercise.stats.totalImprovement / exercise.stats.timesPlayed;
    await exercise.save();

    const feedback = await generateFeedback({
      targetSkill: exercise.targetSkill,
      pitchAccuracy,
      rhythmAccuracy,
      overallScore,
      improvement
    });

    res.status(201).json({
      attempt,
      feedback,
      level: levelAfter,
      leveledUp: levelAfter.level > levelBefore.level
    });
  });

  app.get('/attempts', async (req, res) => {
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    const attempts = await Attempt.find(filter).sort({ playedAt: -1 });
    res.json(attempts);
  });

  app.post('/chat', async (req, res) => {
    const { messages, context } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const reply = await generateChatReply(messages, context);
    res.json({ reply });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });

  cachedApp = app;
  return app;
}

module.exports = { createApp };
