import axios from 'axios';

// Create an isolated instance of axios with pre-configured settings
const API = axios.create({
  baseURL: 'http://localhost:5000/api', // Direct connection to your Express server
  timeout: 10000, // 10 seconds timeout limit
  headers: {
    'Content-Type': 'application/json',
  },
});

// Reusable service methods for our endpoints
export const teamService = {
  getAllTeams: () => API.get('/teams'),
  getTeamsByGroup: (groupName) => API.get(`/teams/group/${groupName}`),
};

export const matchService = {
  getAllMatches: () => API.get('/matches'),
  getMatchById: (id) => API.get(`/matches/${id}`),
};

export default API;