const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  pitch: { type: String, required: true },
  startBeat: { type: Number, required: true },
  durationBeats: { type: Number, required: true }
}, { _id: false });

const exerciseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  targetSkill: {
    type: String,
    required: true,
    enum: ['pitch_accuracy', 'rhythm_accuracy', 'timing', 'interval_accuracy']
  },
  difficulty: { type: Number, required: true, default: 1 },
  tempoBpm: { type: Number, required: true, default: 60 },
  notes: [noteSchema],
  stats: {
    timesPlayed: { type: Number, default: 0 },
    totalImprovement: { type: Number, default: 0 },
    avgImprovement: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
