const express = require('express');
const router = express.Router();

// Destructure all functions from the controller
const { 
    getLiveScores, 
    getFixtures, 
    getMatchCommentary, 
    getMatchEvents, 
    getMatchStatistics, 
    getMatchLineups, 
    getTeamsSquads, 
    getHistoryMatches, 
    getHeadToHead, 
    getLiveStandings, 
    getStandings, 
    getTopGoalscorers, 
    getTopCards,
    getLocalMatches,
    getLocalTeams,
    getLocalStandings
} = require('../controllers/worldcup.controller.js');

// Live Scores & Fixtures
router.get('/livescores', getLiveScores);
router.get('/fixtures', getFixtures);

// Match Details
router.get('/commentary', getMatchCommentary);
router.get('/events', getMatchEvents);
router.get('/statistics', getMatchStatistics);
router.get('/lineups', getMatchLineups);

// Teams & History
router.get('/squads', getTeamsSquads);
router.get('/history', getHistoryMatches);
router.get('/head2head', getHeadToHead);

// Standings
router.get('/livestandings', getLiveStandings);
router.get('/standings', getStandings);

// Player Statistics
router.get('/goalscorers', getTopGoalscorers);
router.get('/cards', getTopCards);

// Local Data Endpoints
router.get('/local/matches', getLocalMatches);
router.get('/local/teams', getLocalTeams);
router.get('/local/standings', getLocalStandings);

module.exports = router;