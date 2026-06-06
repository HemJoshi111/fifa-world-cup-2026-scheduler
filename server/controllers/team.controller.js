import Team from '../models/team.model.js';

// @desc    Get all teams
// @route   GET /api/teams
// @access  Public
export const getTeams = async (req, res) => {
  try {
    const teams = await Team.find({});
    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};

// @desc    Get teams filtered by group
// @route   GET /api/teams/group/:groupName
// @access  Public
export const getTeamsByGroup = async (req, res) => {
  try {
    const groupName = req.params.groupName.toUpperCase();
    const teams = await Team.find({ group: groupName });

    res.status(200).json({
      success: true,
      count: teams.length,
      data: teams
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server Error: ${error.message}`
    });
  }
};