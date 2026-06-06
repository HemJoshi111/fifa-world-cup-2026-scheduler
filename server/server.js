import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import teamRoutes from './routes/team.route.js';
import matchRoutes from './routes/match.route.js';

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/teams', teamRoutes);
app.use('/api/matches', matchRoutes);

// Basic Test Route
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the FIFA World Cup 2026 API Platform!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});