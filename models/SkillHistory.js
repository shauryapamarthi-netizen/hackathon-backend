const mongoose = require('mongoose');

const skillHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  skill: { type: String, required: true },
  score: { type: Number, required: true },
  recordedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SkillHistory', skillHistorySchema);
