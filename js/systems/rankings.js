import { playerDisplayName } from "../data/generators.js";

/**
 * Rankings de clubes e jogadores (liga local + snapshots).
 * Métricas: pontos, desempenho, gols/partida, assistências, nota, etc.
 */

function gamesPlayed(c) {
  return (c.wins || 0) + (c.draws || 0) + (c.losses || 0);
}

function safeDiv(a, b, digits = 2) {
  if (!b) return 0;
  const v = a / b;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Nota de desempenho do clube (0–100) a partir de forma + eficiência */
export function clubPerformanceScore(c) {
  const g = gamesPlayed(c);
  if (!g) return 0;
  const pts = c.points || 0;
  const ppg = pts / g; // 0–3
  const gd = (c.gf || 0) - (c.ga || 0);
  const gpg = (c.gf || 0) / g;
  const winRate = (c.wins || 0) / g;
  // ponderação: resultado > ataque > saldo
  let score = ppg * 22 + winRate * 25 + Math.min(gpg, 3.5) * 8 + clamp(gd, -15, 15) * 1.2;
  score += Math.min(c.cleanSheets || 0, 10) * 1.5;
  return Math.round(clamp(score, 0, 100));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function playerAvgRating(p) {
  if (!p.ratingCount) return 0;
  return safeDiv(p.ratingSum || 0, p.ratingCount, 2);
}

function playerGpg(p) {
  const g = p.games || 0;
  return safeDiv(p.goals || 0, g, 2);
}

function playerApg(p) {
  return safeDiv(p.assists || 0, p.games || 0, 2);
}

/** Score individual de desempenho (artilheiros + nota + volume) */
export function playerPerformanceScore(p) {
  const g = p.games || 0;
  if (!g) return 0;
  const gpg = (p.goals || 0) / g;
  const apg = (p.assists || 0) / g;
  const rating = playerAvgRating(p);
  const motm = p.motm || 0;
  // volume: até 20 jogos contam mais
  const volume = Math.min(g, 20) / 20;
  let score =
    gpg * 28 +
    apg * 18 +
    Math.max(0, rating - 5.5) * 12 +
    motm * 3 +
    volume * 10 +
    Math.min(p.goals || 0, 25) * 0.8;
  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

export function ensurePlayerStats(p) {
  if (p.games == null) p.games = 0;
  if (p.goals == null) p.goals = 0;
  if (p.assists == null) p.assists = 0;
  if (p.ratingSum == null) p.ratingSum = 0;
  if (p.ratingCount == null) p.ratingCount = 0;
  if (p.motm == null) p.motm = 0;
  if (p.seasonGames == null) p.seasonGames = 0;
  if (p.seasonGoals == null) p.seasonGoals = 0;
  if (p.seasonAssists == null) p.seasonAssists = 0;
  return p;
}

export function ensureClubStats(c) {
  if (c.cleanSheets == null) c.cleanSheets = 0;
  if (!Array.isArray(c.form)) c.form = [];
  return c;
}

/**
 * Ranking de clubes da liga local (você + NPCs).
 * sortBy: pts | perf | gpg | ppg | gf | gd | cs
 */
export function clubRankings(game, sortBy = "pts") {
  const rows = [game.state.club, ...game.state.npcs].map((c) => {
    ensureClubStats(c);
    const g = gamesPlayed(c);
    const gf = c.gf || 0;
    const ga = c.ga || 0;
    return {
      id: c.id,
      name: c.name,
      you: c.id === game.state.club.id,
      typeLabel: c.typeLabel || (c.npc ? "Rival" : "Clube"),
      g,
      w: c.wins || 0,
      d: c.draws || 0,
      l: c.losses || 0,
      gf,
      ga,
      gd: gf - ga,
      pts: c.points || 0,
      ppg: safeDiv(c.points || 0, g, 2),
      gpg: safeDiv(gf, g, 2),
      gapg: safeDiv(ga, g, 2),
      cleanSheets: c.cleanSheets || 0,
      form: (c.form || []).slice(-5).join(""),
      perf: clubPerformanceScore(c),
      prestige: c.prestige || 0
    };
  });

  const sorters = {
    pts: (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf,
    perf: (a, b) => b.perf - a.perf || b.pts - a.pts,
    gpg: (a, b) => b.gpg - a.gpg || b.gf - a.gf,
    ppg: (a, b) => b.ppg - a.ppg || b.pts - a.pts,
    gf: (a, b) => b.gf - a.gf || b.gpg - a.gpg,
    gd: (a, b) => b.gd - a.gd || b.pts - a.pts,
    cs: (a, b) => b.cleanSheets - a.cleanSheets || b.pts - a.pts
  };
  rows.sort(sorters[sortBy] || sorters.pts);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Ranking de jogadores (liga inteira ou só seu elenco).
 * sortBy: goals | gpg | assists | rating | perf | apps | motm
 * minGames: mínimo de jogos para G/J e nota (default 1)
 */
export function playerRankings(game, { scope = "league", sortBy = "goals", minGames = 1, seasonOnly = false } = {}) {
  const clubs = [game.state.club, ...game.state.npcs];
  const list = [];

  clubs.forEach((c) => {
    const squad = c.id === game.state.club.id ? game.state.squad : c.squad || [];
    squad.forEach((p) => {
      ensurePlayerStats(p);
      const games = seasonOnly ? p.seasonGames || 0 : p.games || 0;
      const goals = seasonOnly ? p.seasonGoals || 0 : p.goals || 0;
      const assists = seasonOnly ? p.seasonAssists || 0 : p.assists || 0;
      if (games < minGames && sortBy !== "goals" && sortBy !== "apps") {
        // ainda lista artilheiros com 0 jogos? só se minGames 0
      }
      if (scope === "mine" && c.id !== game.state.club.id) return;
      if (games < minGames && ["gpg", "rating", "perf", "apg"].includes(sortBy)) return;

      const gpg = safeDiv(goals, games, 2);
      const apg = safeDiv(assists, games, 2);
      const perf = seasonOnly
        ? Math.round(clamp(gpg * 32 + apg * 22 + Math.min(games, 14) / 14 * 12 + Math.min(goals, 20), 0, 100) * 10) / 10
        : playerPerformanceScore(p);

      list.push({
        id: p.id,
        name: playerDisplayName(p),
        pos: p.pos,
        age: p.age,
        overall: p.overall,
        clubId: c.id,
        clubName: c.name,
        you: c.id === game.state.club.id,
        games,
        goals,
        assists,
        gpg,
        apg,
        rating: playerAvgRating(p),
        motm: p.motm || 0,
        perf,
        seasonGoals: p.seasonGoals || 0,
        seasonAssists: p.seasonAssists || 0,
        seasonGames: p.seasonGames || 0
      });
    });
  });

  const sorters = {
    goals: (a, b) => b.goals - a.goals || b.gpg - a.gpg || b.assists - a.assists,
    gpg: (a, b) => b.gpg - a.gpg || b.goals - a.goals || b.games - a.games,
    assists: (a, b) => b.assists - a.assists || b.apg - a.apg || b.goals - a.goals,
    apg: (a, b) => b.apg - a.apg || b.assists - a.assists,
    rating: (a, b) => b.rating - a.rating || b.games - a.games,
    perf: (a, b) => b.perf - a.perf || b.goals - a.goals,
    apps: (a, b) => b.games - a.games || b.goals - a.goals,
    motm: (a, b) => b.motm - a.motm || b.rating - a.rating
  };
  list.sort(sorters[sortBy] || sorters.goals);
  return list.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Snapshot leve para enviar ao servidor (ranking online) */
export function buildRankingSnapshot(game) {
  if (!game?.state) return null;
  const c = game.state.club;
  ensureClubStats(c);
  const g = gamesPlayed(c);
  const top = playerRankings(game, { scope: "mine", sortBy: "goals", minGames: 0 }).slice(0, 5);
  return {
    clubName: c.name,
    typeLabel: c.typeLabel || null,
    g,
    w: c.wins || 0,
    d: c.draws || 0,
    l: c.losses || 0,
    gf: c.gf || 0,
    ga: c.ga || 0,
    gd: (c.gf || 0) - (c.ga || 0),
    pts: c.points || 0,
    ppg: safeDiv(c.points || 0, g, 2),
    gpg: safeDiv(c.gf || 0, g, 2),
    cleanSheets: c.cleanSheets || 0,
    perf: clubPerformanceScore(c),
    prestige: c.prestige || 0,
    avgOvr:
      game.state.squad.length > 0
        ? Math.round(game.state.squad.reduce((a, p) => a + p.overall, 0) / game.state.squad.length)
        : 0,
    topScorers: top.map((p) => ({
      name: playerDisplayName(p),
      pos: p.pos,
      goals: p.goals,
      assists: p.assists,
      games: p.games,
      gpg: p.gpg,
      rating: p.rating,
      perf: p.perf
    })),
    updatedAt: Date.now()
  };
}
