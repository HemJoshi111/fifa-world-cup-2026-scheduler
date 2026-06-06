import Match from '../models/match.model.js';

// @desc    Get all matches (with populated team details)
// @route   GET /api/matches
// @access  Public
export const getMatches = async (req, res) => {
  try {
    // .populate() replaces the ObjectId references with the actual team documents!
    const matches = await Match.find({})
      .populate('homeTeam', 'name code flagUrl')
      .populate('awayTeam', 'name code flagUrl')
      .sort({ matchDate: 1 }); // Sort chronologically

    res.status(200).json({
      success: true,
      count: matches.length,
      data: matches
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};

// @desc    Get a single match by ID
// @route   GET /api/matches/:id
// @access  Public
export const getMatchById = async (req, res) => {
  try {
    const match = await Match.findById(req.params.id)
      .populate('homeTeam', 'name code flagUrl')
      .populate('awayTeam', 'name code flagUrl');

    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    res.status(200).json({
      success: true,
      data: match
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};