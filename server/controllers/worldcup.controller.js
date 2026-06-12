const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load local data files
const matchesDataPath = path.join(__dirname, '../data/matches.json');
const teamsDataPath = path.join(__dirname, '../data/teams.json');

const localMatchesData = JSON.parse(fs.readFileSync(matchesDataPath, 'utf8'));
const localTeamsData = JSON.parse(fs.readFileSync(teamsDataPath, 'utf8'));

// Create an Axios instance with base URL and default params (API Key)
const apiClient = axios.create({
    baseURL: process.env.WORLD_CUP_BASE_URL,
    params: {
        key: process.env.WORLD_CUP_API_KEY
    }
});

const sportsDbClient = axios.create({
    baseURL: 'https://www.thesportsdb.com/api/v1/json/3',
    timeout: 10000,
});

const liveMatchesClient = axios.create({
    baseURL: 'https://storefront.dishhomego.com.np/dhome/web-app',
    timeout: 20000,
});

const liveStandingsClient = axios.create({
    baseURL: 'https://storefront.dishhomego.com.np/dhome/web-app',
    timeout: 20000,
});

const restCountriesClient = axios.create({
    baseURL: 'https://restcountries.com/v3.1',
    timeout: 10000,
});

const playerPortraitCache = new Map();
const teamPortraitMapCache = new Map();
const nationalFlagCache = new Map();

const COUNTRY_NAME_ALIASES = {
    'korea republic': 'south korea',
    'south korea': 'south korea',
    'ir iran': 'iran',
    'iran islamic republic of': 'iran',
    'czech republic': 'czechia',
    'usa': 'united states',
    'united states of america': 'united states',
    'russian federation': 'russia',
    'ivory coast': "côte d'ivoire",
    'cote d ivoire': "côte d'ivoire",
    'cape verde': 'cabo verde',
    'macedonia': 'north macedonia',
    'swaziland': 'eswatini',
};

function unwrapSquadPlayers(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.player)) return payload.player;
    if (Array.isArray(payload?.players)) return payload.players;
    return [];
}

function pickPlayerPortrait(playerRecord) {
    return (
        playerRecord?.strCutout ||
        playerRecord?.strThumb ||
        playerRecord?.strRender ||
        playerRecord?.strPoster ||
        ''
    );
}

function normalizePortraitLookupResult(playerRecord) {
    const image = pickPlayerPortrait(playerRecord);

    return {
        image,
        photo: image,
        picture: image,
        avatar: image,
        portrait: image,
        thumb: playerRecord?.strThumb || '',
        poster: playerRecord?.strPoster || '',
        cutout: playerRecord?.strCutout || '',
        render: playerRecord?.strRender || '',
        image_source: image ? 'thesportsdb' : '',
    };
}

function normalizePlayerNameKey(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function pickTeamLookupCandidate(teams, teamName) {
    if (!Array.isArray(teams) || !teams.length) return null;

    const lookupKey = normalizeCountryLookupKey(teamName);

    return (
        teams.find((candidate) => normalizeCountryLookupKey(candidate?.strTeam) === lookupKey) ||
        teams.find((candidate) => normalizeCountryLookupKey(candidate?.strCountry) === lookupKey) ||
        teams.find((candidate) => String(candidate?.strSport || '').toLowerCase() === 'soccer') ||
        teams[0] ||
        null
    );
}

async function fetchTeamPortraitMap(teamName) {
    const cacheKey = normalizeCountryLookupKey(teamName);
    if (!cacheKey) return new Map();

    if (teamPortraitMapCache.has(cacheKey)) {
        return teamPortraitMapCache.get(cacheKey);
    }

    try {
        const searchResponse = await sportsDbClient.get('/searchteams.php', {
            params: { t: teamName },
        });

        const candidateTeams = Array.isArray(searchResponse.data?.teams) ? searchResponse.data.teams : [];
        const teamRecord = pickTeamLookupCandidate(candidateTeams, teamName);

        if (!teamRecord?.idTeam) {
            const emptyMap = new Map();
            teamPortraitMapCache.set(cacheKey, emptyMap);
            return emptyMap;
        }

        const playersResponse = await sportsDbClient.get('/lookup_all_players.php', {
            params: { id: teamRecord.idTeam },
        });

        const players = Array.isArray(playersResponse.data?.player) ? playersResponse.data.player : [];
        const portraitMap = new Map();

        players.forEach((playerRecord) => {
            const portrait = normalizePortraitLookupResult(playerRecord);
            if (!portrait.image) return;

            const playerKey = normalizePlayerNameKey(playerRecord?.strPlayer);
            if (!playerKey || portraitMap.has(playerKey)) return;

            portraitMap.set(playerKey, portrait);
        });

        teamPortraitMapCache.set(cacheKey, portraitMap);
        return portraitMap;
    } catch (error) {
        const emptyMap = new Map();
        teamPortraitMapCache.set(cacheKey, emptyMap);
        return emptyMap;
    }
}

async function fetchPlayerPortrait(playerName) {
    const cacheKey = String(playerName || '').trim().toLowerCase();
    if (!cacheKey) return null;

    if (playerPortraitCache.has(cacheKey)) {
        return playerPortraitCache.get(cacheKey);
    }

    try {
        const response = await sportsDbClient.get('/searchplayers.php', {
            params: { p: playerName },
        });
        const candidates = Array.isArray(response.data?.player) ? response.data.player : [];

        const exactMatch = candidates.find((candidate) =>
            String(candidate?.strPlayer || '').trim().toLowerCase() === cacheKey,
        );

        const soccerMatch = exactMatch || candidates.find((candidate) =>
            String(candidate?.strSport || '').toLowerCase() === 'soccer' && pickPlayerPortrait(candidate),
        ) || candidates.find((candidate) => pickPlayerPortrait(candidate));

        const portrait = soccerMatch ? normalizePortraitLookupResult(soccerMatch) : null;
        playerPortraitCache.set(cacheKey, portrait);
        return portrait;
    } catch (error) {
        playerPortraitCache.set(cacheKey, null);
        return null;
    }
}

async function fetchPlayerPortraitForTeam(teamName, playerName) {
    const portraitMap = await fetchTeamPortraitMap(teamName);
    const playerKey = normalizePlayerNameKey(playerName);

    if (portraitMap.has(playerKey)) {
        return portraitMap.get(playerKey);
    }

    return fetchPlayerPortrait(playerName);
}

function normalizeCountryLookupKey(teamName) {
    return String(teamName || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getFlagUrlFromCountryCode(countryCode) {
    const normalizedCode = String(countryCode || '').trim().toLowerCase();
    return normalizedCode ? `https://flagcdn.com/w320/${normalizedCode}.png` : '';
}

async function fetchNationalFlag(teamName, countryCode = '') {
    const lookupKey = normalizeCountryLookupKey(teamName) || String(countryCode || '').toLowerCase();
    if (!lookupKey) return '';

    if (nationalFlagCache.has(lookupKey)) {
        return nationalFlagCache.get(lookupKey);
    }

    const directFlag = getFlagUrlFromCountryCode(countryCode);
    if (directFlag) {
        nationalFlagCache.set(lookupKey, directFlag);
        return directFlag;
    }

    const aliasName = COUNTRY_NAME_ALIASES[lookupKey] || teamName;

    try {
        const response = await restCountriesClient.get(`/name/${encodeURIComponent(aliasName)}`);
        const countryRecord = Array.isArray(response.data) ? response.data[0] : null;
        const flagUrl = countryRecord?.flags?.png || countryRecord?.flags?.svg || '';

        nationalFlagCache.set(lookupKey, flagUrl);
        return flagUrl;
    } catch (error) {
        nationalFlagCache.set(lookupKey, '');
        return '';
    }
}

async function enrichFixturesWithNationalFlags(fixtures) {
    const teamLookup = new Map();

    fixtures.forEach((match) => {
        if (match?.home?.name) {
            teamLookup.set(normalizeCountryLookupKey(match.home.name), match.home.countryCode || '');
        }
        if (match?.away?.name) {
            teamLookup.set(normalizeCountryLookupKey(match.away.name), match.away.countryCode || '');
        }
    });

    await Promise.all(Array.from(teamLookup.entries()).map(([teamName, countryCode]) => fetchNationalFlag(teamName, countryCode)));

    return fixtures.map((match) => {
        const homeFlag = match?.home?.name
            ? nationalFlagCache.get(normalizeCountryLookupKey(match.home.name)) || getFlagUrlFromCountryCode(match.home.countryCode)
            : '';
        const awayFlag = match?.away?.name
            ? nationalFlagCache.get(normalizeCountryLookupKey(match.away.name)) || getFlagUrlFromCountryCode(match.away.countryCode)
            : '';

        return {
            ...match,
            home: match?.home
                ? {
                    ...match.home,
                    logo: homeFlag || match.home.logo,
                    flag: homeFlag || match.home.flag || '',
                }
                : match.home,
            away: match?.away
                ? {
                    ...match.away,
                    logo: awayFlag || match.away.logo,
                    flag: awayFlag || match.away.flag || '',
                }
                : match.away,
        };
    });
}

async function enrichStandingsWithNationalFlags(standings) {
    const teamNames = new Set();

    standings.forEach((standing) => {
        const teamName = standing?.team?.name;
        if (teamName) teamNames.add(teamName);
    });

    await Promise.all(Array.from(teamNames).map((teamName) => fetchNationalFlag(teamName)));

    return standings.map((standing) => {
        const teamName = standing?.team?.name;
        const lookupKey = normalizeCountryLookupKey(teamName);
        const flagUrl = teamName ? nationalFlagCache.get(lookupKey) || '' : '';

        return {
            ...standing,
            team: standing?.team
                ? {
                    ...standing.team,
                    logo: flagUrl || standing.team.logo,
                    flag: flagUrl || standing.team.flag || '',
                }
                : standing.team,
        };
    });
}

function unwrapFixturesResponse(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    return [];
}

// Normalize our custom matches data to standard fixture format
function normalizeLocalMatches(matches) {
    const teamMap = new Map((localTeamsData?.list || []).map((team) => [
        String(team?.teamName || '').toLowerCase(),
        team,
    ]));

    return matches.map((match, index) => {
        const home = match.participants?.find((p) => p.isHome);
        const away = match.participants?.find((p) => !p.isHome);
        const homeTeam = teamMap.get(String(home?.name || '').toLowerCase()) || {};
        const awayTeam = teamMap.get(String(away?.name || '').toLowerCase()) || {};

        return {
            ...match,
            match_number: Number(String(match?.details || '').replace(/\D/g, '')) || index + 1,
            stage: match?.stage || 'Group Stage',
            local_date: match?.start || match?.startTimestamp || null,
            venue: match?.venue || {},
            home: home
                ? {
                    id: homeTeam?.id || null,
                    name: home.name,
                    shortCode: home.shortCode || homeTeam?.teamShortCode || '',
                    countryCode: home.countryCode || homeTeam?.countryCode || '',
                    logo: homeTeam?.logo || '',
                    flag: homeTeam?.flag || '',
                }
                : null,
            away: away
                ? {
                    id: awayTeam?.id || null,
                    name: away.name,
                    shortCode: away.shortCode || awayTeam?.teamShortCode || '',
                    countryCode: away.countryCode || awayTeam?.countryCode || '',
                    logo: awayTeam?.logo || '',
                    flag: awayTeam?.flag || '',
                }
                : null,
        };
    });
}

async function fetchFixturesPage(query, page) {
    const response = await apiClient.get('/fixtures', {
        params: {
            ...query,
            page,
        }
    });

    return unwrapFixturesResponse(response.data);
}

// --- LIVE SCORES & FIXTURES ---

const getLiveScores = async (req, res) => {
    try {
        const response = await apiClient.get('/livescores');
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching live scores", error: error.message });
    }
};

const getFixtures = async (req, res) => {
    try {
        // Use local matches data instead of external API
        const allMatches = localMatchesData?.list || [];
        const normalizedFixtures = normalizeLocalMatches(allMatches);
        const enrichedFixtures = await enrichFixturesWithNationalFlags(normalizedFixtures);
        
        res.status(200).json(enrichedFixtures);
    } catch (error) {
        res.status(500).json({ message: "Error fetching fixtures", error: error.message });
    }
};

// --- MATCH DETAILS ---

const getMatchCommentary = async (req, res) => {
    try {
        const response = await apiClient.get('/commentary', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching match commentary", error: error.message });
    }
};

const getMatchEvents = async (req, res) => {
    try {
        const response = await apiClient.get('/events', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching match events", error: error.message });
    }
};

const getMatchStatistics = async (req, res) => {
    try {
        const response = await apiClient.get('/statistics', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching match statistics", error: error.message });
    }
};

const getMatchLineups = async (req, res) => {
    try {
        const response = await apiClient.get('/lineups', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching match lineups", error: error.message });
    }
};

// --- CONCURRENCY LIMITER ---
function createConcurrencyLimiter(max) {
    let running = 0;
    const queue = [];

    const run = async (fn) => {
        while (running >= max) {
            await new Promise((resolve) => queue.push(resolve));
        }
        running++;
        try {
            return await fn();
        } finally {
            running--;
            const resolve = queue.shift();
            if (resolve) resolve();
        }
    };

    return { run };
}

// --- TEAMS & HISTORY ---

const getTeamsSquads = async (req, res) => {
    try {
        const { team_name: teamNameQuery, ...squadQuery } = req.query;
        const response = await apiClient.get('/squads', { params: squadQuery });
        const players = unwrapSquadPlayers(response.data);
        const teamName = teamNameQuery || players?.[0]?.team_name || players?.[0]?.team || '';
        
        // Pre-fetch team portrait map once for all players
        await fetchTeamPortraitMap(teamName);
        
        const limiter = createConcurrencyLimiter(3);
        const enrichedPlayers = await Promise.all(
            players.map((player) =>
                limiter.run(async () => {
                    const portrait = await fetchPlayerPortraitForTeam(teamName, player?.name);
                    return {
                        ...player,
                        ...(portrait || {}),
                    };
                })
            )
        );

        res.status(200).json(enrichedPlayers);
    } catch (error) {
        res.status(500).json({ message: "Error fetching team squads", error: error.message });
    }
};

const getHistoryMatches = async (req, res) => {
    try {
        const response = await apiClient.get('/history', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching match history", error: error.message });
    }
};

const getHeadToHead = async (req, res) => {
    try {
        const response = await apiClient.get('/head2head', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching head-to-head data", error: error.message });
    }
};

// --- STANDINGS ---

const getLiveStandings = async (req, res) => {
    try {
        const response = await apiClient.get('/livestandings', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching live standings", error: error.message });
    }
};

const getStandings = async (req, res) => {
    try {
        const response = await apiClient.get('/standings', { params: req.query });
        const payload = response.data;
        const standings = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
        const enrichedStandings = await enrichStandingsWithNationalFlags(standings);

        if (Array.isArray(payload)) {
            return res.status(200).json(enrichedStandings);
        }

        if (Array.isArray(payload?.data)) {
            return res.status(200).json({ ...payload, data: enrichedStandings });
        }

        res.status(200).json(payload);
    } catch (error) {
        res.status(500).json({ message: "Error fetching standings", error: error.message });
    }
};

// --- PLAYER STATISTICS ---

const getTopGoalscorers = async (req, res) => {
    try {
        const response = await apiClient.get('/goalscorers', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching top goalscorers", error: error.message });
    }
};

const getTopCards = async (req, res) => {
    try {
        const response = await apiClient.get('/cards', { params: req.query });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Error fetching card statistics", error: error.message });
    }
};

// --- LOCAL DATA ENDPOINTS ---

const getLocalMatches = async (req, res) => {
    try {
        const liveMatchesResponse = await liveMatchesClient.get('/matches');
        const liveMatches = Array.isArray(liveMatchesResponse?.data?.list) ? liveMatchesResponse.data.list : [];
        const liveMatchMap = new Map(
            liveMatches.map((match) => [String(match?.matchId || match?.id || match?.details || match?.title || '').trim(), match])
        );

        const allMatches = (localMatchesData?.list || []).map((match) => {
            const liveMatch = liveMatchMap.get(String(match?.matchId || match?.id || match?.details || match?.title || '').trim());

            return {
                ...match,
                state: liveMatch?.state || match?.state || 'Not Started',
                result: liveMatch?.result || match?.result || null,
                start: liveMatch?.start || match?.start || null,
                stage: liveMatch?.stage || match?.stage || 'Group Stage',
                venue: liveMatch?.venue || match?.venue || null,
                participants: liveMatch?.participants || match?.participants || [],
            };
        });

        const normalizedFixtures = normalizeLocalMatches(allMatches);
        const enrichedFixtures = await enrichFixturesWithNationalFlags(normalizedFixtures);

        res.status(200).json({
            list: enrichedFixtures,
            total: enrichedFixtures.length,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching local matches', error: error.message });
    }
};

const getLocalTeams = async (req, res) => {
    try {
        const allTeams = localTeamsData?.list || [];
        
        // Enrich teams with flags
        await Promise.all(allTeams.map(team => fetchNationalFlag(team.teamName, team.countryCode)));
        
        const enrichedTeams = allTeams.map(team => {
            const flag = nationalFlagCache.get(normalizeCountryLookupKey(team.teamName)) || getFlagUrlFromCountryCode(team.countryCode) || '';
            return {
                ...team,
                flag,
                logo: flag
            };
        });
        
        res.status(200).json({
            list: enrichedTeams,
            total: enrichedTeams.length
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching local teams", error: error.message });
    }
};

const getLocalStandings = async (req, res) => {
    try {
        const liveStandingsResponse = await liveStandingsClient.get('/standings');
        const allGroups = liveStandingsResponse?.data?.list || [];

        if (!allGroups.length) {
            throw new Error('Live standings payload did not contain any groups.');
        }

        // Enrich standings with flags
        const allTeams = [];
        allGroups.forEach(group => {
            if (group.teams && Array.isArray(group.teams)) {
                allTeams.push(...group.teams.map(t => ({ name: t.teamName, countryCode: t.countryCode })));
            }
        });
        
        const uniqueTeams = [...new Map(allTeams.map((team) => [normalizeCountryLookupKey(team.name), team])).values()];
        await Promise.all(uniqueTeams.map((team) => fetchNationalFlag(team.name, team.countryCode)));
        
        const enrichedGroups = allGroups.map(group => ({
            ...group,
            teams: (group.teams || []).map(team => {
                const flag = nationalFlagCache.get(normalizeCountryLookupKey(team.teamName)) || getFlagUrlFromCountryCode(team.countryCode) || '';
                return {
                    ...team,
                    flag,
                    logo: flag
                };
            })
        }));
        
        res.status(200).json({
            list: enrichedGroups,
            total: enrichedGroups.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching local standings', error: error.message });
    }
};

module.exports = {
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
};