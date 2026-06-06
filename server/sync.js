import axios from 'axios';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Team from './models/team.model.js';

// Load variables and connect to database
dotenv.config();
connectDB();

const fetchAndSyncTeams = async () => {
  try {
    console.log('📡 Reaching out to API-Football...');

    const config = {
      headers: {
        'x-rapidapi-key': process.env.API_FOOTBALL_KEY,
        'x-rapidapi-host': 'v3.football.api-sports.io'
      }
    };

    // League 1 is the World Cup. Using 2022 dataset as the 2026 draw isn't finalized yet.
    const response = await axios.get('https://v3.football.api-sports.io/teams?league=1&season=2022', config);
    const apiTeams = response.data.response;

    if (!apiTeams || apiTeams.length === 0) {
      console.log('⚠️ No teams found. Check your API key or endpoint.');
      process.exit();
    }

    console.log(`✅ Found ${apiTeams.length} teams. Syncing to MongoDB Atlas...`);

    // 1. Clear out any old data to prevent duplicates
    await Team.deleteMany();

    // 2. Format the API data to match our Mongoose Schema
    const teamsToInsert = apiTeams.map((item) => {
      return {
        name: item.team.name,
        code: item.team.code || item.team.name.substring(0, 3).toUpperCase(),
        flagUrl: item.team.logo,
        group: 'A', // The /teams endpoint doesn't return groups, so we use a placeholder for now
      };
    });

    // 3. Insert into database
    await Team.insertMany(teamsToInsert);

    console.log('🎉 Data sync complete! Teams successfully saved to the database.');
    process.exit();

  } catch (error) {
    console.error(`❌ Error fetching data: ${error.message}`);
    process.exit(1);
  }
};

// Run the function
fetchAndSyncTeams();