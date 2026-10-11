const mongoose = require('mongoose');

const attemptSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
  pitchAccuracy: { type: Number, required: true },
  rhythmAccuracy: { type: Number, required: true },
  overallScore: { type: Number, required: true },
  improvement: { type: Number, default: 0 },
  playedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attempt', attemptSchema);
