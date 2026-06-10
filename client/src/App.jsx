import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  PlayCircle,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { DateTime } from "luxon";
import { apiGet } from "./api.js";

const menu = [
  { to: "/", label: "Overview" },
  { to: "/matches", label: "Matches" },
  { to: "/teams", label: "Teams" },
  { to: "/groups", label: "Groups" },
  { to: "/players", label: "Players" },
];

function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-badge">
            <span className="badge-icon">⚽</span>
            <span className="badge-text">FIFA WORLD CUP 2026</span>
          </div>
        </div>
        <nav className="nav nav-modern">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link nav-item ${isActive ? "active" : ""}`
              }
              end={item.to === "/"}
            >
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="content-wrap">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailsPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/stadiums" element={<PlayersPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

// --- Utility Functions ---

function sortMatchesByNumber(list) {
  return [...list].sort((a, b) => {
    const aDate = parseMatchDateTime(a?.local_date, "UTC")?.toMillis?.();
    const bDate = parseMatchDateTime(b?.local_date, "UTC")?.toMillis?.();

    if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
    if (Number.isFinite(aDate)) return -1;
    if (Number.isFinite(bDate)) return 1;

    const aNum = Number(a?.id);
    const bNum = Number(b?.id);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    if (!Number.isNaN(aNum)) return -1;
    if (!Number.isNaN(bNum)) return 1;
    return 0;
  });
}

const STADIUM_TIMEZONE_BY_NAME = {
  "Estadio Azteca": "America/Mexico_City",
  "MetLife Stadium": "America/New_York",
  "AT&T Stadium": "America/Chicago",
  "SoFi Stadium": "America/Los_Angeles",
  "Gillette Stadium": "America/New_York",
};

const NEPAL_TIMEZONE = "Asia/Kathmandu";

function getViewerTimeZone() {
  return NEPAL_TIMEZONE;
}

function getStadiumTimeZone(stadium) {
  if (!stadium?.name_en) return "UTC";
  const stadiumName = stadium.name_en.toLowerCase();
  const matchedZone = Object.entries(STADIUM_TIMEZONE_BY_NAME).find(([name]) =>
    stadiumName.includes(name.toLowerCase()),
  )?.[1];
  return matchedZone || "UTC";
}

function parseMatchDateTime(localDateTime, stadiumTimeZone) {
  if (!localDateTime) return null;
  const formats = [
    ["yyyy-MM-dd HH:mm:ss", { zone: "UTC" }],
    ["yyyy-MM-dd HH:mm", { zone: "UTC" }],
    ["yyyy-MM-dd", { zone: "UTC" }],
    ["MM/dd/yyyy HH:mm", { zone: "UTC" }],
  ];

  for (const [format, options] of formats) {
    const parsed = DateTime.fromFormat(localDateTime, format, options);
    if (parsed.isValid) return parsed;
  }

  const parsedSql = DateTime.fromSQL(localDateTime, {
    zone: "UTC",
  });
  if (parsedSql.isValid) return parsedSql;

  const parsedIso = DateTime.fromISO(localDateTime, { zone: "UTC" });
  if (parsedIso.isValid) return parsedIso;

  return null;
}

function formatMatchDateInViewerZone(
  localDateTime,
  stadiumTimeZone,
  viewerTimeZone,
) {
  const parsed = parseMatchDateTime(localDateTime, stadiumTimeZone);
  if (!parsed) return "TBD";
  return parsed.setZone(viewerTimeZone).toFormat("ccc, LLL dd");
}

function formatMatchTimeInViewerZone(
  localDateTime,
  stadiumTimeZone,
  viewerTimeZone,
) {
  const parsed = parseMatchDateTime(localDateTime, stadiumTimeZone);
  if (!parsed) return "TBD";
  return parsed.setZone(viewerTimeZone).toFormat("hh:mm a");
}

function getMatchStageInfo(match, groupLabel) {
  const roundValue = String(match?.round || "")
    .toUpperCase()
    .trim();

  if (/^\d+$/.test(roundValue)) {
    return {
      key: "group",
      label: groupLabel ? `Group ${groupLabel}` : "Group Stage",
    };
  }

  if (roundValue === "R32") {
    return { key: "r32", label: "Round of 32" };
  }

  if (roundValue === "R16") {
    return { key: "r16", label: "Round of 16" };
  }

  if (roundValue === "QF") {
    return { key: "qf", label: "QUATER-FINAL" };
  }

  if (roundValue === "SF") {
    return { key: "sf", label: "SEMI-FINAL" };
  }

  if (roundValue === "3PPO" || roundValue === "3P" || roundValue === "3RD") {
    return { key: "third", label: "Third-Place Playoff" };
  }

  if (roundValue === "F") {
    return { key: "final", label: "Final" };
  }

  return {
    key: roundValue.toLowerCase() || "group",
    label: roundValue || "Group Stage",
  };
}

function buildGroupLabelMap(fixturesArray) {
  const groupLabelMap = new Map();
  const groupStageFixtures = fixturesArray.filter((match) =>
    /^\d+$/.test(String(match?.round || "")),
  );

  for (const match of groupStageFixtures) {
    const groupId = match?.group_id;
    if (!groupId || groupLabelMap.has(groupId)) continue;
    const groupLetter = String.fromCharCode(65 + groupLabelMap.size);
    groupLabelMap.set(groupId, groupLetter);
  }

  return groupLabelMap;
}

function isRealTeamName(teamName) {
  if (!teamName) return false;
  return !/^(winner|runner-up|loser|third|3rd|winner r|winner qf|loser sf)/i.test(
    teamName.trim(),
  );
}

function extractRealTeamsFromFixtures(fixturesArray) {
  const groupLabelMap = buildGroupLabelMap(fixturesArray);
  const realFixtures = fixturesArray.filter((match) =>
    /^\d+$/.test(String(match?.round || "")),
  );
  const teamsMap = new Map();

  realFixtures.forEach((match) => {
    const groupLabel = groupLabelMap?.get(match?.group_id);
    const candidates = [
      {
        id: match?.home?.id,
        name_en: match?.home?.name,
        flag: match?.home?.logo,
      },
      {
        id: match?.away?.id,
        name_en: match?.away?.name,
        flag: match?.away?.logo,
      },
    ];

    candidates.forEach((team) => {
      if (!team.id || !isRealTeamName(team.name_en)) return;
      if (teamsMap.has(team.id)) return;

      teamsMap.set(team.id, {
        id: team.id,
        _id: team.id,
        name_en: team.name_en,
        fifa_code: team.name_en?.substring(0, 3).toUpperCase(),
        flag: team.flag,
        group_label: groupLabel,
        group_name: groupLabel ? `Group ${groupLabel}` : undefined,
      });
    });
  });

  return Array.from(teamsMap.values()).sort((a, b) =>
    a.name_en.localeCompare(b.name_en),
  );
}

// Data Extraction Logic: Extracts unique teams and stadiums from the external API fixtures array
function normalizeFixture(match, groupLabelMap, matchNumber) {
  const homeTeam = match?.home || {};
  const awayTeam = match?.away || {};
  const stadiumName = match?.stadium_name || match?.location || "";
  const stadiumId =
    match?.stadium_id || stadiumName || `stadium-${match?.id || "tba"}`;
  const matchDate =
    match?.local_date ||
    (match?.date && match?.time
      ? `${match.date} ${match.time}`
      : match?.date || null);
  const groupLabel = groupLabelMap?.get(match?.group_id);
  const stageInfo = getMatchStageInfo(match, groupLabel);

  return {
    ...match,
    match_number: matchNumber,
    home_team_id: homeTeam?.id,
    home_team_en: homeTeam?.name,
    home_team_label: homeTeam?.name,
    home_team_logo: homeTeam?.logo,
    away_team_id: awayTeam?.id,
    away_team_en: awayTeam?.name,
    away_team_label: awayTeam?.name,
    away_team_logo: awayTeam?.logo,
    stadium_id: stadiumId,
    stadium_name: stadiumName,
    local_date: matchDate,
    group: groupLabel
      ? `Group ${groupLabel}`
      : match?.group || (match?.group_id ? String(match.group_id) : undefined),
    group_label: groupLabel,
    type: stageInfo.key,
    stage_label: stageInfo.label,
    status: match?.status || "upcoming",
  };
}

function extractDataFromFixtures(fixturesArray) {
  const groupLabelMap = buildGroupLabelMap(fixturesArray);
  const normalizedFixtures = fixturesArray.map((match, index) =>
    normalizeFixture(match, groupLabelMap, index + 1),
  );
  const teamsMap = new Map();
  const stadiumsMap = new Map();

  normalizedFixtures.forEach((match) => {
    if (match.home_team_id && !teamsMap.has(match.home_team_id)) {
      teamsMap.set(match.home_team_id, {
        id: match.home_team_id,
        _id: match.home_team_id,
        name_en: match.home_team_en || match.home_team_label,
        fifa_code: match.home_team_en?.substring(0, 3).toUpperCase(),
        flag: match.home_team_logo,
      });
    }
    if (match.away_team_id && !teamsMap.has(match.away_team_id)) {
      teamsMap.set(match.away_team_id, {
        id: match.away_team_id,
        _id: match.away_team_id,
        name_en: match.away_team_en || match.away_team_label,
        fifa_code: match.away_team_en?.substring(0, 3).toUpperCase(),
        flag: match.away_team_logo,
      });
    }
    if (match.stadium_id && !stadiumsMap.has(match.stadium_id)) {
      stadiumsMap.set(match.stadium_id, {
        id: match.stadium_id,
        _id: match.stadium_id,
        name_en: match.stadium_name || `Stadium ${match.stadium_id}`,
        city_en: "Host City",
        capacity: 60000,
      });
    }
  });

  return {
    fixtures: normalizedFixtures,
    teams: Array.from(teamsMap.values()),
    stadiums: Array.from(stadiumsMap.values()),
  };
}

function unwrapArrayResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.squads)) return response.squads;
  if (Array.isArray(response?.players)) return response.players;
  return [];
}

const CACHE_TTL_MS = 10 * 60 * 1000;

function getCachedData(key) {
  try {
    const cached = sessionStorage.getItem(key);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== "object") return null;

    if (Date.now() - Number(parsed.timestamp || 0) > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedData(key, data) {
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ timestamp: Date.now(), data }),
    );
  } catch {
    // Ignore storage failures gracefully.
  }
}

async function fetchWithCache(key, fetcher) {
  const cached = getCachedData(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  setCachedData(key, fresh);
  return fresh;
}

function sortPlayers(players) {
  return [...players].sort((left, right) => {
    const leftNumber = Number(left?.shirt_number);
    const rightNumber = Number(right?.shirt_number);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }

    if (Number.isFinite(leftNumber)) return -1;
    if (Number.isFinite(rightNumber)) return 1;

    return String(left?.name || "").localeCompare(String(right?.name || ""));
  });
}

function getPlayerImageUrl(player) {
  const directImage =
    player?.image ||
    player?.photo ||
    player?.picture ||
    player?.avatar ||
    player?.portrait ||
    player?.img ||
    "";

  if (directImage) return directImage;

  const initials = getPlayerInitials(player?.name);
  const shirtNumber = player?.shirt_number
    ? `#${player.shirt_number}`
    : "Squad";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${initials}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8b84e" />
          <stop offset="100%" stop-color="#74d6ff" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="36" fill="url(#g)" />
      <circle cx="120" cy="92" r="42" fill="rgba(255,255,255,0.18)" />
      <path d="M52 204c14-34 40-52 68-52s54 18 68 52" fill="rgba(255,255,255,0.18)" />
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#07111f" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="800">${initials}</text>
      <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" fill="#07111f" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700">${shirtNumber}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getPlayerInitials(name) {
  const parts = String(name || "Player")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getPositionLabel(position) {
  const code = String(position || "").toUpperCase();
  const labels = {
    GK: "Goalkeeper",
    DF: "Defender",
    MF: "Midfielder",
    FW: "Forward",
    ST: "Striker",
  };

  return labels[code] || code || "Squad";
}

function getTeamById(fixtures, teamId) {
  return extractRealTeamsFromFixtures(fixtures).find(
    (team) => String(team.id) === String(teamId),
  );
}

// --- Pages ---

function OverviewPage() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetchWithCache("worldcup-fixtures", () =>
          apiGet("/fixtures"),
        );
        const matchesData = response?.data || response || [];
        const extracted = extractDataFromFixtures(matchesData);

        setMatches(extracted.fixtures);
        setTeams(extracted.teams.slice(0, 8));
        setStadiums(extracted.stadiums);
      } catch (err) {
        setError(
          "Make sure your Express backend is running on port 5000: " +
            err.message,
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stadiumMap = useMemo(
    () => Object.fromEntries(stadiums.map((s) => [s.id, s])),
    [stadiums],
  );

  const summary = { teams: 48, groups: 12, matches: 104, stadiums: 16 };
  const visibleMatches = matches;

  return (
    <div className="page-stack overview-page">
      {/* Hero Premium Section */}
      <section className="hero-premium">
        <div className="hero-content">
          <div className="hero-eyebrow">FIFA WORLD CUP 2026</div>
          <h1 className="hero-title">
            The Ultimate Global Tournament Experience
          </h1>
          <p className="hero-subtitle">
            Immerse yourself in the world's greatest football championship.
            Track live scores, explore team rosters, analyze statistics, and
            follow every moment of the tournament across 48 nations and 104
            matches.
          </p>
          <div className="hero-cta-group">
            <NavLink
              to="/matches"
              className="button button-primary button-large"
            >
              <PlayCircle size={18} />
              Watch Live Matches
            </NavLink>
            <NavLink
              to="/groups"
              className="button button-secondary button-large"
            >
              <Trophy size={18} />
              View Groups & Standings
            </NavLink>
          </div>
        </div>
        <div className="hero-stats-compact">
          <div className="stat-badge">
            <span className="stat-value">48</span>
            <span className="stat-label">Nations</span>
          </div>
          <div className="stat-badge">
            <span className="stat-value">104</span>
            <span className="stat-label">Matches</span>
          </div>
          <div className="stat-badge">
            <span className="stat-value">12</span>
            <span className="stat-label">Groups</span>
          </div>
          <div className="stat-badge">
            <span className="stat-value">16</span>
            <span className="stat-label">Stadiums</span>
          </div>
        </div>
      </section>

      {loading ? <LoadingSpinner label="Loading tournament data..." /> : null}
      {error && <div className="notice error">{error}</div>}

      {!loading && (
        <>
          {/* Featured Matches Section */}
          <section className="featured-section">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-title">Upcoming Fixtures</h2>
                <p className="section-subtitle">Don't miss the action ahead</p>
              </div>
              <NavLink to="/matches" className="see-all-link">
                View all matches
                <ChevronRight size={16} />
              </NavLink>
            </div>
            <div className="featured-matches-grid">
              {visibleMatches.slice(0, 3).map((match) => (
                <div
                  key={match.id || match._id}
                  className="featured-match-card"
                >
                  <MatchRow
                    match={match}
                    teams={Object.fromEntries(teams.map((t) => [t.id, t]))}
                    stadiums={stadiumMap}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Quick Navigation Section */}
          <section className="navigation-hub">
            <div className="nav-hub-title">Explore Everything</div>
            <div className="nav-grid-premium">
              <NavLink to="/teams" className="nav-card nav-card-teams">
                <div className="nav-card-icon">
                  <Users size={28} />
                </div>
                <h3>Teams & Squads</h3>
                <p>Discover all 48 nations and their complete rosters</p>
              </NavLink>
              <NavLink to="/groups" className="nav-card nav-card-groups">
                <div className="nav-card-icon">
                  <Shield size={28} />
                </div>
                <h3>Group Stage</h3>
                <p>Follow group standings and matchups in real-time</p>
              </NavLink>
              <NavLink to="/players" className="nav-card nav-card-players">
                <div className="nav-card-icon">
                  <Sparkles size={28} />
                </div>
                <h3>Player Stats</h3>
                <p>Track top scorers, assists, and individual performance</p>
              </NavLink>
              <NavLink to="/matches" className="nav-card nav-card-matches">
                <div className="nav-card-icon">
                  <Calendar size={28} />
                </div>
                <h3>Full Schedule</h3>
                <p>Browse the complete tournament calendar and results</p>
              </NavLink>
            </div>
          </section>

          {/* Stats and Teams Grid */}
          <section className="stats-teams-section">
            {/* Tournament Snapshot */}
            <article className="tournament-snapshot-card">
              <div className="card-header">
                <h3>Tournament Snapshot</h3>
                <p className="card-subtitle">Key figures at a glance</p>
              </div>
              <div className="snapshot-stats">
                <div className="snapshot-stat">
                  <div className="stat-circle">
                    <Trophy size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{summary.teams}</span>
                    <span className="stat-name">Participating Teams</span>
                  </div>
                </div>
                <div className="snapshot-stat">
                  <div className="stat-circle">
                    <Shield size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{summary.groups}</span>
                    <span className="stat-name">Group Divisions</span>
                  </div>
                </div>
                <div className="snapshot-stat">
                  <div className="stat-circle">
                    <Calendar size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{summary.matches}</span>
                    <span className="stat-name">Total Matches</span>
                  </div>
                </div>
                <div className="snapshot-stat">
                  <div className="stat-circle">
                    <MapPin size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-number">{summary.stadiums}</span>
                    <span className="stat-name">Host Stadiums</span>
                  </div>
                </div>
              </div>
            </article>

            {/* Featured Teams */}
            <article className="featured-teams-card">
              <div className="card-header">
                <h3>Featured Nations</h3>
                <p className="card-subtitle">Explore the top contenders</p>
              </div>
              <div className="featured-teams-grid">
                {teams.map((team) => (
                  <TeamChip
                    key={team.id || team._id}
                    team={team}
                    to={`/teams/${team.id || team._id}`}
                  />
                ))}
              </div>
              <NavLink to="/teams" className="view-all-teams-btn">
                View All Teams
                <ChevronRight size={16} />
              </NavLink>
            </article>
          </section>

          {/* Info Cards */}
          <section className="info-cards-section">
            <div className="info-card info-card-primary">
              <div className="info-card-content">
                <h4>Real-Time Updates</h4>
                <p>
                  Get live scores, match statistics, and instant notifications
                  for every game played across all stadiums worldwide.
                </p>
              </div>
              <Sparkles className="info-card-icon" size={32} />
            </div>
            <div className="info-card info-card-secondary">
              <div className="info-card-content">
                <h4>Complete Analytics</h4>
                <p>
                  Deep dive into team performance, player statistics,
                  head-to-head records, and historical tournament data.
                </p>
              </div>
              <Shield className="info-card-icon" size={32} />
            </div>
            <div className="info-card info-card-tertiary">
              <div className="info-card-content">
                <h4>Tournament Coverage</h4>
                <p>
                  From group stage to final, access comprehensive coverage of
                  every match, venue, and iconic moment in the tournament.
                </p>
              </div>
              <Trophy className="info-card-icon" size={32} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetchWithCache("worldcup-fixtures", () =>
          apiGet("/fixtures"),
        );
        const matchesData = response?.data || response || [];
        const extracted = extractDataFromFixtures(matchesData);

        setMatches(extracted.fixtures);
        setTeams(extracted.teams);
        setStadiums(extracted.stadiums);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  );
  const stadiumMap = useMemo(
    () => Object.fromEntries(stadiums.map((s) => [s.id, s])),
    [stadiums],
  );

  const visibleMatches = matches.filter((match) => {
    const groupOk = groupFilter === "all" || match.group === groupFilter;
    const typeOk = typeFilter === "all" || match.type === typeFilter;
    return groupOk && typeOk;
  });

  const stageOptions = [
    { value: "all", label: "All Stages" },
    { value: "group", label: "Group Stage" },
    { value: "r32", label: "Round of 32" },
    { value: "r16", label: "Round of 16" },
    { value: "qf", label: "Quarter-Final" },
    { value: "sf", label: "Semi-Final" },
    { value: "third", label: "Third-Place" },
    { value: "final", label: "Final" },
  ];

  return (
    <div className="page-stack">
      <div className="matches-filter-bar">
        <h2>Matches</h2>
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="stage-select">Stage:</label>
            <select
              id="stage-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-dropdown"
            >
              {stageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading matches..." /> : null}

      {!loading ? (
        <section className="card">
          <div className="match-grid">
            {visibleMatches.map((match, index) => (
              <MatchCard
                key={match.id || match._id}
                match={match}
                teams={teamMap}
                stadiums={stadiumMap}
                index={index}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetchWithCache("worldcup-fixtures", () => apiGet("/fixtures"))
      .then((res) => {
        const fixtures = res?.data || res || [];
        setTeams(extractRealTeamsFromFixtures(fixtures));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const groupOptions = [
    { value: "all", label: "All Groups" },
    ...Array.from(new Set(teams.map((t) => t.group_name).filter(Boolean)))
      .sort()
      .map((group) => ({
        value: group,
        label: group,
      })),
  ];

  const visibleTeams = teams.filter((team) =>
    groupFilter === "all" ? true : team.group_name === groupFilter,
  );

  return (
    <div className="page-stack">
      <div className="teams-filter-bar">
        <h2>Teams</h2>
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="group-select">Group:</label>
            <select
              id="group-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="filter-dropdown"
            >
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading teams..." /> : null}
      {error ? <div className="notice error">{error}</div> : null}

      {!loading ? (
        <section className="team-grid">
          {visibleTeams.map((team, index) => (
            <Link
              key={team.id || team._id}
              to={`/teams/${team.id || team._id}`}
              className="team-card-link"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <article className="card team-card">
                <div className="team-card-crest">
                  {team.flag ? (
                    <img src={team.flag} alt={team.name_en} />
                  ) : (
                    <span>{team.fifa_code}</span>
                  )}
                </div>
                <div className="team-card-body">
                  <div className="team-card-topline">
                    <h3>{team.name_en || "TBA"}</h3>
                    <span className="team-card-code">{team.fifa_code}</span>
                  </div>
                  <p className="team-card-group">
                    {team.group_name || "Group Stage"}
                  </p>
                </div>
                <div className="team-card-chevron">
                  <ChevronRight size={16} />
                </div>
              </article>
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TeamDetailsPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!teamId) {
        setError("Missing team identifier.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const fixturesResponse = await fetchWithCache("worldcup-fixtures", () =>
          apiGet("/fixtures"),
        );
        const fixtures = unwrapArrayResponse(fixturesResponse);
        const matchedTeam = getTeamById(fixtures, teamId) || {
          id: teamId,
          _id: teamId,
          name_en: `Team ${teamId}`,
          fifa_code: String(teamId).slice(0, 3).toUpperCase(),
          flag: "",
          group_name: "Group Stage",
        };

        const squadResponse = await fetchWithCache(
          `worldcup-squad:${teamId}:${matchedTeam.name_en || ""}`,
          () =>
            apiGet(
              `/squads?team_id=${teamId}&team_name=${encodeURIComponent(matchedTeam.name_en || "")}`,
            ),
        );
        const squadPlayers = sortPlayers(unwrapArrayResponse(squadResponse));

        if (!active) return;

        setTeam(matchedTeam);
        setPlayers(squadPlayers);
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load team details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [teamId]);

  const roleOptions = useMemo(
    () => [
      { value: "all", label: "All Roles" },
      { value: "GK", label: "Goalkeepers" },
      { value: "DF", label: "Defenders" },
      { value: "MF", label: "Midfielders" },
      { value: "FW", label: "Forwards" },
    ],
    [],
  );

  const visiblePlayers = useMemo(
    () =>
      players.filter((player) => {
        const code = String(player?.position || "").toUpperCase();
        return roleFilter === "all" || code === roleFilter;
      }),
    [players, roleFilter],
  );

  const playerStats = useMemo(() => {
    return players.reduce(
      (accumulator, player) => {
        const position = String(player?.position || "UNK").toUpperCase();
        if (position === "GK") accumulator.gk += 1;
        else if (position === "DF") accumulator.df += 1;
        else if (position === "MF") accumulator.mf += 1;
        else if (position === "FW") accumulator.fw += 1;
        else accumulator.other += 1;
        return accumulator;
      },
      { gk: 0, df: 0, mf: 0, fw: 0, other: 0 },
    );
  }, [players]);

  return (
    <div className="page-stack team-details-page">
      <section className="card team-detail-hero">
        <Link to="/teams" className="back-link">
          <ArrowLeft size={16} /> Back to teams
        </Link>

        <div className="team-detail-hero-inner">
          <div className="team-detail-brand">
            <div className="team-detail-crest">
              {team?.flag ? (
                <img src={team.flag} alt={team.name_en} />
              ) : (
                <span>{team?.fifa_code || "TBD"}</span>
              )}
            </div>
            <div className="team-detail-copy">
              <div className="eyebrow">Squad detail</div>
              <h2>{team?.name_en || "Team squad"}</h2>
              <div className="team-detail-badges">
                <span className="detail-badge badge-chip-soft badge-chip-glow">
                  <span className="badge-icon-shell" aria-hidden="true">
                    <Shield size={13} />
                  </span>
                  Official squad
                </span>
                <span className="detail-badge detail-badge-accent badge-chip-glow">
                  <span className="badge-icon-shell" aria-hidden="true">
                    <Trophy size={13} />
                  </span>
                  {team?.group_name || "Group Stage"}
                </span>
                <span className="detail-badge badge-chip-soft badge-chip-glow">
                  <span className="badge-icon-shell" aria-hidden="true">
                    <Users size={13} />
                  </span>
                  {players.length} players
                </span>
              </div>
            </div>
          </div>

          <div className="team-detail-stats">
            <Stat label="Players" value={players.length} />
            <Stat label="Goalkeepers" value={playerStats.gk} />
            <Stat label="Defenders" value={playerStats.df} />
            <Stat label="Midfielders" value={playerStats.mf} />
            <Stat label="Forwards" value={playerStats.fw} />
            <Stat label="Other roles" value={playerStats.other} />
          </div>
        </div>
      </section>

      {loading ? <LoadingSpinner label="Loading squad details..." /> : null}
      {error ? <div className="notice error">{error}</div> : null}

      {!loading && !error ? (
        <section className="card squad-section">
          <div className="section-head">
            <div>
              <h3>Player roster</h3>
            </div>
            <div className="filter-controls">
              <div className="filter-group">
                <label htmlFor="role-select">Role:</label>
                <select
                  id="role-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="filter-dropdown"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="squad-grid">
            {visiblePlayers.map((player, index) => {
              const avatarUrl = getPlayerImageUrl(player);

              return (
                <article
                  className="card player-card"
                  key={`${player.id || player.name}-${index}`}
                  style={{ animationDelay: `${index * 24}ms` }}
                >
                  <div className="player-avatar-shell">
                    {avatarUrl ? (
                      <img
                        className="player-avatar-image"
                        src={avatarUrl}
                        alt={player.name || "Player"}
                      />
                    ) : (
                      <div className="player-avatar-fallback">
                        {getPlayerInitials(player.name)}
                      </div>
                    )}
                  </div>
                  <div className="player-card-body">
                    <div className="player-card-topline">
                      <h3>{player.name || "Unknown player"}</h3>
                      <span className="player-shirt">
                        #{player.shirt_number || "-"}
                      </span>
                    </div>
                    <div className="player-card-meta">
                      <span className="player-position player-role-chip">
                        <span
                          className="badge-icon-shell badge-icon-shell-small"
                          aria-hidden="true"
                        >
                          <Sparkles size={11} />
                        </span>
                        {getPositionLabel(player.position)}
                      </span>
                      <span className="player-id">ID {player.id || "N/A"}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GroupsPage() {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("all");
  const groupIds = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => String.fromCharCode(65 + index)),
    [],
  );

  useEffect(() => {
    let active = true;

    async function loadStandings() {
      try {
        setLoading(true);
        const responses = await Promise.all(
          groupIds.map((groupId) =>
            fetchWithCache(`worldcup-standings:${groupId}`, () =>
              apiGet(`/standings?group=${groupId}`),
            ),
          ),
        );

        if (!active) return;

        const groupTables = responses
          .map((response, index) => {
            const rows = Array.isArray(response?.data)
              ? response.data
              : Array.isArray(response)
                ? response
                : [];

            return {
              _id: groupIds[index],
              group: groupIds[index],
              teams: rows,
            };
          })
          .filter((group) => group.teams.length > 0);

        setStandings(groupTables);
      } catch (error) {
        if (active) {
          setStandings([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStandings();

    return () => {
      active = false;
    };
  }, [groupIds]);

  const groupOptions = [
    { value: "all", label: "All Groups" },
    ...standings.map((group) => ({
      value: group.group,
      label: `Group ${group.group}`,
    })),
  ];

  const visibleStandings = standings.filter((group) =>
    groupFilter === "all" ? true : group.group === groupFilter,
  );

  function getStandingTeamName(standing) {
    return (
      standing?.team?.name || standing?.team_name || standing?.name_en || "Team"
    );
  }

  function getStandingTeamLogo(standing) {
    return (
      standing?.team?.flag ||
      standing?.team?.logo ||
      standing?.flag ||
      standing?.logo ||
      ""
    );
  }

  function getStandingTeamId(standing) {
    return standing?.team?.id || standing?.team_id || standing?.id || "";
  }

  function getStandingValue(standing, keys) {
    for (const key of keys) {
      const value = standing?.[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }

    return 0;
  }

  return (
    <div className="page-stack">
      <div className="groups-filter-bar">
        <h2>Groups</h2>
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="group-select">Group:</label>
            <select
              id="group-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="filter-dropdown"
            >
              {groupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner label="Loading standings..." /> : null}

      {!loading ? (
        <section className="group-grid">
          {visibleStandings.map((group) => (
            <article key={group._id} className="card group-card">
              <div className="section-head">
                <h3>Group {group.group}</h3>
                <span className="muted">{group.teams.length} teams</span>
              </div>
              <div className="table-scroll">
                <table className="standings-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>
                        <abbr title="Matches Played">MP</abbr>
                      </th>
                      <th>
                        <abbr title="Wins">W</abbr>
                      </th>
                      <th>
                        <abbr title="Draws">D</abbr>
                      </th>
                      <th>
                        <abbr title="Losses">L</abbr>
                      </th>
                      <th>
                        <abbr title="Goals For">GF</abbr>
                      </th>
                      <th>
                        <abbr title="Goals Against">GA</abbr>
                      </th>
                      <th>
                        <abbr title="Goal Difference">GD</abbr>
                      </th>
                      <th>
                        <abbr title="Points">Pts</abbr>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.teams.map((standing) => (
                      <tr key={getStandingTeamId(standing)}>
                        <td>
                          <Link
                            to={`/teams/${getStandingTeamId(standing)}`}
                            state={{
                              team: {
                                id: getStandingTeamId(standing),
                                _id: getStandingTeamId(standing),
                                name_en: getStandingTeamName(standing),
                                fifa_code: getStandingTeamName(standing)
                                  .slice(0, 3)
                                  .toUpperCase(),
                                flag: getStandingTeamLogo(standing),
                              },
                            }}
                            className="standing-team-link"
                          >
                            <div className="standing-team-cell">
                              <span className="standing-team-rank">
                                {getStandingValue(standing, ["rank"])}
                              </span>
                              <span className="standing-team-crest">
                                {getStandingTeamLogo(standing) ? (
                                  <img
                                    src={getStandingTeamLogo(standing)}
                                    alt={getStandingTeamName(standing)}
                                  />
                                ) : (
                                  <span>
                                    {getStandingTeamName(standing)
                                      .slice(0, 3)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span className="standing-team-name">
                                {getStandingTeamName(standing)}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td>
                          {getStandingValue(standing, [
                            "matches",
                            "played",
                            "mp",
                          ])}
                        </td>
                        <td>
                          {getStandingValue(standing, ["won", "wins", "w"])}
                        </td>
                        <td>
                          {getStandingValue(standing, ["drawn", "draws", "d"])}
                        </td>
                        <td>
                          {getStandingValue(standing, ["lost", "losses", "l"])}
                        </td>
                        <td>
                          {getStandingValue(standing, [
                            "goals_scored",
                            "goals_for",
                            "gf",
                          ])}
                        </td>
                        <td>
                          {getStandingValue(standing, [
                            "goals_conceded",
                            "goals_against",
                            "ga",
                          ])}
                        </td>
                        <td>
                          {getStandingValue(standing, [
                            "goal_diff",
                            "gd",
                            "goal_difference",
                          ])}
                        </td>
                        <td>
                          <strong>
                            {getStandingValue(standing, ["points", "pts"])}
                          </strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function PlayersPage() {
  const [countryGroups, setCountryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const playerCount = useMemo(
    () =>
      countryGroups.reduce(
        (total, group) => total + (group?.players?.length || 0),
        0,
      ),
    [countryGroups],
  );

  useEffect(() => {
    let active = true;

    async function loadAllPlayers() {
      try {
        setLoading(true);
        setError("");

        const fixturesResponse = await fetchWithCache("worldcup-fixtures", () =>
          apiGet("/fixtures"),
        );
        const fixtures = unwrapArrayResponse(fixturesResponse);
        const teams = extractRealTeamsFromFixtures(fixtures);

        const results = await Promise.allSettled(
          teams.map(async (team) => {
            const squadResponse = await fetchWithCache(
              `worldcup-squad:${team.id}:${team.name_en || ""}`,
              () =>
                apiGet(
                  `/squads?team_id=${team.id}&team_name=${encodeURIComponent(team.name_en || "")}`,
                ),
            );
            const players = sortPlayers(unwrapArrayResponse(squadResponse)).map(
              (player) => ({
                ...player,
                country: team.name_en,
                country_flag: team.flag,
                country_code: team.fifa_code,
              }),
            );

            return {
              team,
              players,
            };
          }),
        );

        const groups = results
          .map((result) =>
            result.status === "fulfilled" ? result.value : null,
          )
          .filter((group) => group && group.players.length > 0)
          .sort((a, b) => a.team.name_en.localeCompare(b.team.name_en));

        if (active) {
          setCountryGroups(groups);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load players.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAllPlayers();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page-stack players-page">
      <div className="teams-filter-bar">
        <h2>Players</h2>
      </div>

      {loading ? <LoadingSpinner label="Loading players..." /> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="country-stack">
        {countryGroups.map(({ team, players }, index) => (
          <article
            key={team.id || team._id}
            className="card country-card"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <div className="section-head country-head">
              <div className="country-title">
                <span className="country-crest">
                  {team.flag ? (
                    <img src={team.flag} alt={team.name_en} />
                  ) : (
                    <span>{team.fifa_code}</span>
                  )}
                </span>
                <div>
                  <h3>{team.name_en}</h3>
                  <p>{players.length} players</p>
                </div>
              </div>
              <span className="country-badge">{team.fifa_code}</span>
            </div>

            <div className="country-players-grid">
              {players.map((player, playerIndex) => {
                const avatarUrl = getPlayerImageUrl(player);

                return (
                  <article
                    className="card player-card"
                    key={`${team.id}-${player.id || player.name}-${playerIndex}`}
                    style={{ animationDelay: `${playerIndex * 20}ms` }}
                  >
                    <div className="player-avatar-shell">
                      {avatarUrl ? (
                        <img
                          className="player-avatar-image"
                          src={avatarUrl}
                          alt={player.name || "Player"}
                        />
                      ) : (
                        <div className="player-avatar-fallback">
                          {getPlayerInitials(player.name)}
                        </div>
                      )}
                    </div>
                    <div className="player-card-body">
                      <div className="player-card-topline">
                        <h3>{player.name || "Unknown player"}</h3>
                        <span className="player-shirt">
                          #{player.shirt_number || "-"}
                        </span>
                      </div>
                      <div className="player-card-meta">
                        <span className="player-position">
                          {getPositionLabel(player.position)}
                        </span>
                        <span className="player-country">{player.country}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

// --- Shared Components ---

function LoadingSpinner({ label = "Loading..." }) {
  return (
    <div className="loading-shell" role="status" aria-live="polite">
      <div className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MatchRow({ match, teams, stadiums }) {
  const homeTeamId = match.home_team_id ?? match.home?.id;
  const awayTeamId = match.away_team_id ?? match.away?.id;
  const homeTeam = teams[homeTeamId];
  const awayTeam = teams[awayTeamId];
  const homeCode =
    homeTeam?.fifa_code ||
    match.home_team_label?.substring(0, 3)?.toUpperCase() ||
    "TBD";
  const awayCode =
    awayTeam?.fifa_code ||
    match.away_team_label?.substring(0, 3)?.toUpperCase() ||
    "TBD";
  const stadium = stadiums[match.stadium_id];
  const viewerTimeZone = getViewerTimeZone();
  const stadiumTimeZone = getStadiumTimeZone(stadium);
  const date = formatMatchDateInViewerZone(
    match.local_date,
    stadiumTimeZone,
    viewerTimeZone,
  );
  const time = formatMatchTimeInViewerZone(
    match.local_date,
    stadiumTimeZone,
    viewerTimeZone,
  );

  return (
    <div className="fixture-card-modern">
      <div className="fixture-teams-row">
        <div className="fixture-team-cell">
          <div className="fixture-team-flag">
            {homeTeam?.flag ? (
              <img src={homeTeam.flag} alt={homeCode} title={homeCode} />
            ) : (
              <span className="fixture-flag-fallback">
                {homeCode?.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span className="fixture-team-code">{homeCode}</span>
        </div>
        <div className="fixture-vs-badge">VS</div>
        <div className="fixture-team-cell">
          <span className="fixture-team-code">{awayCode}</span>
          <div className="fixture-team-flag">
            {awayTeam?.flag ? (
              <img src={awayTeam.flag} alt={awayCode} title={awayCode} />
            ) : (
              <span className="fixture-flag-fallback">
                {awayCode?.substring(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="fixture-details-row">
        <div className="fixture-detail-item">
          <MapPin size={16} className="fixture-icon" />
          <span className="fixture-detail-text">
            {stadium?.name_en || `Stadium ${match.stadium_id || "TBA"}`}
          </span>
        </div>

        <div className="fixture-detail-item">
          <Calendar size={16} className="fixture-icon" />
          <span className="fixture-detail-text">{date}</span>
        </div>

        <div className="fixture-detail-item">
          <Clock size={16} className="fixture-icon" />
          <span className="fixture-detail-text">{time}</span>
        </div>
      </div>
    </div>
  );
}

function TeamChip({ team, to }) {
  const chip = (
    <div className="chip">
      {team.flag ? (
        <img src={team.flag} alt={team.name_en} />
      ) : (
        <div className="chip-fallback">{team.fifa_code || "TBA"}</div>
      )}
      <div>
        <strong>{team.name_en || "TBA"}</strong>
        <span>{team.fifa_code}</span>
      </div>
    </div>
  );

  if (!to) {
    return chip;
  }

  return (
    <Link className="chip-link" to={to}>
      {chip}
    </Link>
  );
}

function resolveMatchNumber(match, index) {
  return match?.match_number || index + 1;
}

function MatchCard({ match, teams, stadiums, index }) {
  const homeTeamId = match.home_team_id ?? match.home?.id;
  const awayTeamId = match.away_team_id ?? match.away?.id;
  const homeTeam = teams[homeTeamId];
  const awayTeam = teams[awayTeamId];
  const stadium = stadiums[match.stadium_id];
  const stageLabel = match.stage_label || "Group Stage";
  const stageBadgeClass = `match-stage match-stage-${match.type || "group"}`;
  const homeCode =
    homeTeam?.fifa_code ||
    match.home_team_label?.substring(0, 3) ||
    match.home?.name?.substring(0, 3) ||
    "TBD";
  const awayCode =
    awayTeam?.fifa_code ||
    match.away_team_label?.substring(0, 3) ||
    match.away?.name?.substring(0, 3) ||
    "TBD";
  const isLive = match?.status?.toLowerCase?.() === "live";
  const venue =
    stadium?.name_en ||
    match?.stadium_name ||
    match?.location ||
    `Stadium ${match?.stadium_id || "TBA"}`;
  const displayDate = formatMatchDateInViewerZone(
    match.local_date,
    getStadiumTimeZone(stadium),
    getViewerTimeZone(),
  );
  const displayTime = formatMatchTimeInViewerZone(
    match.local_date,
    getStadiumTimeZone(stadium),
    getViewerTimeZone(),
  );

  return (
    <article className="match-card">
      <div className="match-card-top">
        <span className="match-number">
          Match {resolveMatchNumber(match, index)}
        </span>
        <div className="match-badge-group">
          <span className={stageBadgeClass}>{stageLabel}</span>
          {isLive ? (
            <span className="match-status match-status-live">
              <span className="live-dot" /> LIVE
            </span>
          ) : null}
        </div>
      </div>
      <div className="match-teams-row">
        <div className="match-team">
          <div className="team-logo-shell">
            {homeTeam?.flag ? (
              <img
                src={homeTeam.flag}
                className="match-team-logo"
                alt={homeCode}
              />
            ) : (
              <span className="team-logo-fallback">{homeCode}</span>
            )}
          </div>
          <span className="team-code">{homeCode}</span>
        </div>
        <div className="match-versus">VS</div>
        <div className="match-team">
          <div className="team-logo-shell">
            {awayTeam?.flag ? (
              <img
                src={awayTeam.flag}
                className="match-team-logo"
                alt={awayCode}
              />
            ) : (
              <span className="team-logo-fallback">{awayCode}</span>
            )}
          </div>
          <span className="team-code">{awayCode}</span>
        </div>
      </div>
      <div className="match-meta-panel">
        <div className="match-meta-row">
          <span className="match-meta-item">
            <Calendar size={14} className="match-meta-icon" />
            {displayDate}
          </span>
          <span className="match-meta-item">
            <Clock size={14} className="match-meta-icon" />
            {displayTime}
          </span>
        </div>
        <div className="match-meta-divider" />
        <div className="match-venue-row">
          <MapPin size={14} className="match-meta-icon" />
          <span className="match-venue-text">{venue}</span>
        </div>
      </div>
      {isLive ? (
        <button className="match-action match-action-live" type="button">
          <PlayCircle size={18} /> Watch Live Now
        </button>
      ) : (
        <div className="match-action match-action-upcoming">
          <span>⏳</span> Event Not Started
        </div>
      )}
    </article>
  );
}

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* About Section */}
          <div className="footer-column">
            <h4 className="footer-title">About Platform</h4>
            <p className="footer-description">
              FIFA World Cup 2026 Studio is a comprehensive platform for
              real-time tournament data, squad information, match fixtures, and
              venue intelligence. Built with modern web technologies to deliver
              a seamless experience for fans worldwide.
            </p>
          </div>

          {/* Quick Links */}
          <div className="footer-column">
            <h4 className="footer-title">Quick Links</h4>
            <nav className="footer-links">
              <NavLink to="/" className="footer-link">
                Overview
              </NavLink>
              <NavLink to="/matches" className="footer-link">
                Matches
              </NavLink>
              <NavLink to="/teams" className="footer-link">
                Teams
              </NavLink>
              <NavLink to="/groups" className="footer-link">
                Groups
              </NavLink>
              <NavLink to="/players" className="footer-link">
                Players
              </NavLink>
            </nav>
          </div>

          {/* Features */}
          <div className="footer-column">
            <h4 className="footer-title">Features</h4>
            <ul className="footer-list">
              <li>Live Match Tracking</li>
              <li>Team Squads & Stats</li>
              <li>Timezone Support</li>
              <li>Venue Information</li>
              <li>Player Profiles</li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom">
          <div className="footer-credit">
            <span>Made with</span>
            <span className="heart-beat">❤️</span>
            <span>by Hem Joshi</span>
          </div>
          <div className="footer-copyright">
            <p>
              &copy; {currentYear} FIFA World Cup 2026 Studio. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default App;
