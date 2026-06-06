import express from 'express';
import { getTeams, getTeamsByGroup } from '../controllers/team.controller.js';

const router = express.Router();

// Route to get all teams
// Endpoint: GET /api/teams
router.get('/', getTeams);

// Route to get teams by a specific group
// Endpoint: GET /api/teams/group/:groupName
router.get('/group/:groupName', getTeamsByGroup);

export default router;