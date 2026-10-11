require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const Exercise = require('./models/Exercise');
const Attempt = require('./models/Attempt');
const SkillHistory = require('./models/SkillHistory');
const { pickNextExercise } = require('./lib/adaptive');
const { generateFeedback, generateChatReply } = require('./lib/claude');

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/simple', express.static(path.join(__dirname, 'public')));

const SEED_EXERCISES = [
  {
    title: 'C major scale, slow',
    targetSkill: 'pitch_accuracy',
    difficulty: 1,
    tempoBpm: 60,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 1 },
      { pitch: 'D4', startBeat: 1, durationBeats: 1 },
      { pitch: 'E4', startBeat: 2, durationBeats: 1 },
      { pitch: 'F4', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'C major scale, fast',
    targetSkill: 'pitch_accuracy',
    difficulty: 2,
    tempoBpm: 120,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 0.5 },
      { pitch: 'D4', startBeat: 0.5, durationBeats: 0.5 },
      { pitch: 'E4', startBeat: 1, durationBeats: 0.5 },
      { pitch: 'F4', startBeat: 1.5, durationBeats: 0.5 }
    ]
  },
  {
    title: 'Steady quarter notes',
    targetSkill: 'rhythm_accuracy',
    difficulty: 1,
    tempoBpm: 80,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 1 },
      { pitch: 'C4', startBeat: 1, durationBeats: 1 },
      { pitch: 'C4', startBeat: 2, durationBeats: 1 },
      { pitch: 'C4', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Syncopated rhythm drill',
    targetSkill: 'rhythm_accuracy',
    difficulty: 3,
    tempoBpm: 100,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 0.5 },
      { pitch: 'C4', startBeat: 0.75, durationBeats: 0.25 },
      { pitch: 'C4', startBeat: 1.5, durationBeats: 0.5 },
      { pitch: 'C4', startBeat: 2.5, durationBeats: 1 }
    ]
  },
  {
    title: 'Metronome lock-in',
    targetSkill: 'timing',
    difficulty: 2,
    tempoBpm: 90,
    notes: [
      { pitch: 'G4', startBeat: 0, durationBeats: 1 },
      { pitch: 'G4', startBeat: 1, durationBeats: 1 },
      { pitch: 'G4', startBeat: 2, durationBeats: 1 },
      { pitch: 'G4', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Octave leaps',
    targetSkill: 'interval_accuracy',
    difficulty: 2,
    tempoBpm: 70,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 1 },
      { pitch: 'C5', startBeat: 1, durationBeats: 1 },
      { pitch: 'C4', startBeat: 2, durationBeats: 1 },
      { pitch: 'C5', startBeat: 3, durationBeats: 1 }
    ]
  },
  {
    title: 'Fifths practice',
    targetSkill: 'interval_accuracy',
    difficulty: 1,
    tempoBpm: 60,
    notes: [
      { pitch: 'C4', startBeat: 0, durationBeats: 1 },
      { pitch: 'G4', startBeat: 1, durationBeats: 1 },
      { pitch: 'C4', startBeat: 2, durationBeats: 1 },
      { pitch: 'G4', startBeat: 3, durationBeats: 1 }
    ]
  }
];

async function start() {
  await connectDB();

  const existingCount = await Exercise.countDocuments();
  if (existingCount === 0) {
    await Exercise.insertMany(SEED_EXERCISES);
    console.log(`Seeded ${SEED_EXERCISES.length} exercises`);
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

    const { exercise, weakestSkill, skillAverages } = await pickNextExercise(userId);
    if (!exercise) {
      return res.status(404).json({ error: `No exercises found for skill ${weakestSkill}` });
    }

    res.json({ exercise, weakestSkill, skillAverages });
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

    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const overallScore = (pitchAccuracy + rhythmAccuracy) / 2;

    const lastSkillEntry = await SkillHistory.findOne({ userId, skill: exercise.targetSkill })
      .sort({ recordedAt: -1 });
    const improvement = lastSkillEntry ? overallScore - lastSkillEntry.score : 0;

    const attempt = await Attempt.create({
      userId,
      exerciseId,
      pitchAccuracy,
      rhythmAccuracy,
      overallScore,
      improvement
    });

    await SkillHistory.create({ userId, skill: exercise.targetSkill, score: overallScore });

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

    res.status(201).json({ attempt, feedback });
  });

  app.get('/attempts', async (req, res) => {
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;
    const attempts = await Attempt.find(filter).sort({ playedAt: -1 });
    res.json(attempts);
  });

  app.post('/chat', async (req, res) => {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }
    const reply = await generateChatReply(messages);
    res.json({ reply });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
