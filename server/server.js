import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Configure environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Test Route
app.get('/', (req, res) => {
  res.json({ message: "Welcome to the FIFA World Cup 2026 API Platform!" });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running smoothly on port ${PORT}`);
});