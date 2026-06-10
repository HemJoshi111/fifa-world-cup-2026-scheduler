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
    getTopCards 
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

module.exports = router;