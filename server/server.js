require('dotenv').config();
const express = require('express');
const cors = require('cors');
const worldCupRoutes = require('./routes/worldcup.routes.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // We handle CORS here on the backend
app.use(express.json());

// Routes
app.use('/api/v1/worldcup', worldCupRoutes);

// Base route for testing
app.get('/', (req, res) => {
    res.send('World Cup API Proxy Server is running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});