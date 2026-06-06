import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Team from './models/team.model.js';
import Match from './models/match.model.js';

// Load variables and connect to database
dotenv.config();
connectDB();

// Helper to normalize the API round string to our schema's stage enum
const normalizeStage = (round) => {
  if (round.includes('Group Stage')) return 'Group Stage';
  if (round.includes('Round of 32')) return 'Round of 32';
  if (round.includes('Round of 16')) return 'Round of 16';
  if (round.includes('Quarter-finals')) return 'Quarter-finals';
  if (round.includes('Semi-finals')) return 'Semi-finals';
  if (round.includes('Match for 3rd Place')) return 'Third-place play-off';
  if (round.includes('Final')) return 'Final';
  return 'Group Stage';
};

const fetchAndSyncMatches = async () => {
  try {
    console.log('📡 Fetching match fixtures from API-Football...');

    const config = {
      headers: {
        'x-rapidapi-key': process.env.API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    };

    // Pulling the 2022 World Cup matches as our development placeholder
    const response = await axios.get('https://v3.football.api-sports.io/fixtures?league=1&season=2022', config);
    const fixtures = response.data.response;

    if (!fixtures || fixtures.length === 0) {
      console.log('⚠️ No match fixtures found.');
      process.exit();
    }

    console.log(`✅ Found ${fixtures.length} matches. Resolving team references...`);

    // Fetch all existing teams from Atlas to map names to ObjectIds quickly in memory
    const existingTeams = await Team.find({});
    const teamMap = new Map(existingTeams.map(t => [t.name.toLowerCase(), t._id]));

    // Clear old match data to avoid duplicates during synchronization tests
    await Match.deleteMany();

    const matchesToInsert = [];

    for (const item of fixtures) {
      const homeTeamName = item.teams.home.name.toLowerCase();
      const awayTeamName = item.teams.away.name.toLowerCase();

      const homeTeamId = teamMap.get(homeTeamName);
      const awayTeamId = teamMap.get(awayTeamName);

      // Skip the entry if either team doesn't exist in our database setup
      if (!homeTeamId || !awayTeamId) {
        continue;
      }

      matchesToInsert.push({
        apiMatchId: item.fixture.id,
        homeTeam: homeTeamId,
        awayTeam: awayTeamId,
        homeScore: item.goals.home !== null ? item.goals.home : 0,
        awayScore: item.goals.away !== null ? item.goals.away : 0,
        matchDate: new Date(item.fixture.date),
        stage: normalizeStage(item.league.round),
        status: ['NS', 'LIVE', 'FT', 'CANC'].includes(item.fixture.status.short) ? item.fixture.status.short : 'NS',
        venue: item.fixture.venue.name || 'TBD'
      });
    }

    // Insert structured documents into the collection
    await Match.insertMany(matchesToInsert);
    console.log(`🎉 Success! ${matchesToInsert.length} relational matches successfully synced to MongoDB Atlas.`);
    process.exit();

  } catch (error) {
    console.error(`❌ Match Synchronization Failed: ${error.message}`);
    process.exit(1);
  }
};

fetchAndSyncMatches();