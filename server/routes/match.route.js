import express from 'express';
import { getMatches, getMatchById } from '../controllers/match.controller.js';

const router = express.Router();

// Route to get all matches
// Endpoint: GET /api/matches
router.get('/', getMatches);

// Route to get a specific match by ID
// Endpoint: GET /api/matches/:id
router.get('/:id', getMatchById);

export default router;