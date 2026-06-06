import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  apiMatchId: {
    type: Number,
    unique: true,
    sparse: true // Allows us to map this to the API-Football fixture ID later
  },
  homeTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  awayTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  homeScore: {
    type: Number,
    default: 0
  },
  awayScore: {
    type: Number,
    default: 0
  },
  matchDate: {
    type: Date,
    required: true
  },
  stage: {
    type: String,
    required: true,
    enum: ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Third-place play-off', 'Final'],
    default: 'Group Stage'
  },
  status: {
    type: String,
    required: true,
    enum: ['NS', 'LIVE', 'FT', 'CANC'], // NS = Not Started, FT = Full Time, CANC = Cancelled
    default: 'NS'
  },
  venue: {
    type: String,
    trim: true,
    default: 'TBD'
  }
}, { timestamps: true });

export default mongoose.model('Match', matchSchema);