import { MATCH_ENERGY_COST, SEASON_THEMES } from "../config/constants.js";
import { playerDisplayName, refreshPlayerDerived } from "../data/generators.js";
import { rand, clamp, formatMoney } from "../core/utils.js";
import { injurePlayer } from "./injuries.js";
import { bestXI, tacticalMatchup, teamStrength } from "./tactics.js";
import { ensurePlayerStats, ensureClubStats, clubRankings } from "./rankings.js";
import { simulateMatchNarrative, buildLiveSnapshot } from "./matchSim.js";
import { applyDisciplineFromMatch } from "./availability.js";
import { getStartingXI, getBenchPlayers, ensureLineup } from "./lineup.js";
import { pushLedger } from "./finance.js";
import { homeGateBonus } from "./facilities.js";
import { evolveNpcs } from "./npcEvolve.js";
import { ensureSeasonGoals } from "./seasonGoals.js";
import { recordNpcIncome } from "./npcAi.js";

/** Temporada completa em turno e returno: todos os clubes jogam em cada rodada. */
export function generateFixtures(game) {
  const fixtures = [];
  const me = game.state.club.id;
  const orderedNpcs = [...game.state.npcs].sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
  const ids = [me, ...orderedNpcs.map((c) => c.id)];
  if (ids.length % 2) ids.push(null);
  const rotation = [...ids];
  const rounds = rotation.length - 1;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < rotation.length / 2; i++) {
      const a = rotation[i];
      const b = rotation[rotation.length - 1 - i];
      if (!a || !b) continue;
      const flip = (round + i) % 2 === 1;
      fixtures.push({
        home: flip ? b : a,
        away: flip ? a : b,
        round: round + 1,
        leg: 1,
        played: false,
        result: null
      });
    }
    rotation.splice(1, 0, rotation.pop());
  }

  const firstLeg = [...fixtures];
  firstLeg.forEach((f) => {
    fixtures.push({
      home: f.away,
      away: f.home,
      round: f.round + rounds,
      leg: 2,
      played: false,
      result: null
    });
  });
  game.state.seasonFixtures = fixtures;
  game.state.nextFixtureIndex = 0;
}

export function getNextFixture(game) {
  const me = game.state.club.id;
  const idx = game.state.seasonFixtures.findIndex(
    (x) => !x.played && (x.home === me || x.away === me)
  );
  if (idx < 0) return null;
  return { fixture: game.state.seasonFixtures[idx], index: idx };
}

function applyResult(club, gf, ga, result) {
  club.gf += gf;
  club.ga += ga;
  if (result === "W") {
    club.wins++;
    club.points += 3;
  } else if (result === "D") {
    club.draws++;
    club.points += 1;
  } else {
    club.losses++;
  }
}

function findPlayerById(game, id) {
  return (
    game.state.squad.find((p) => p.id === id) ||
    game.state.npcs.flatMap((c) => c.squad).find((p) => p.id === id)
  );
}

function findPlayerClub(game, playerId) {
  if (game.state.squad.some((player) => player.id === playerId)) return game.state.club;
  return game.state.npcs.find((club) =>
    (club.squad || []).some((player) => player.id === playerId)
  );
}

function pushForm(club, letter) {
  ensureClubStats(club);
  club.form = club.form || [];
  club.form.push(letter);
  if (club.form.length > 8) club.form.shift();
}

function registerSimpleResult(home, away, hg, ag) {
  if (hg > ag) {
    applyResult(home, hg, ag, "W");
    applyResult(away, ag, hg, "L");
    pushForm(home, "V");
    pushForm(away, "D");
  } else if (hg === ag) {
    applyResult(home, hg, ag, "D");
    applyResult(away, ag, hg, "D");
    pushForm(home, "E");
    pushForm(away, "E");
  } else {
    applyResult(home, hg, ag, "L");
    applyResult(away, ag, hg, "W");
    pushForm(home, "D");
    pushForm(away, "V");
  }
  if (ag === 0) home.cleanSheets = (home.cleanSheets || 0) + 1;
  if (hg === 0) away.cleanSheets = (away.cleanSheets || 0) + 1;
}

function simulateNpcFixture(game, fixture) {
  if (fixture.played) return;
  const home = game.getClub(fixture.home);
  const away = game.getClub(fixture.away);
  const satOutHome = new Set(
    (home.squad || []).filter((p) => p.suspension?.matchesLeft > 0).map((p) => p.id)
  );
  const satOutAway = new Set(
    (away.squad || []).filter((p) => p.suspension?.matchesLeft > 0).map((p) => p.id)
  );
  const homeXI = bestXI(game.getSquad(home.id), home.formation);
  const awayXI = bestXI(game.getSquad(away.id), away.formation);
  if (homeXI.length < 11 || awayXI.length < 11) {
    const hg = homeXI.length >= 11 ? 3 : 0;
    const ag = awayXI.length >= 11 ? 3 : 0;
    const consume = (squad, ids) => squad.forEach((player) => {
      if (!ids.has(player.id) || !player.suspension) return;
      player.suspension.matchesLeft -= 1;
      if (player.suspension.matchesLeft <= 0) player.suspension = null;
    });
    consume(home.squad || [], satOutHome);
    consume(away.squad || [], satOutAway);
    registerSimpleResult(home, away, hg, ag);
    recordNpcIncome(game.state, home, hg > ag ? 650 : hg === ag ? 350 : 200, "match");
    recordNpcIncome(game.state, away, ag > hg ? 650 : ag === hg ? 350 : 200, "match");
    fixture.played = true;
    fixture.result = {
      hg,
      ag,
      events: [{ min: 0, kind: "walkover", drama: true, text: "Partida decidida por ausência de atletas aptos." }]
    };
    return;
  }
  const homeFit = tacticalMatchup(home, away).multiplier;
  const awayFit = tacticalMatchup(away, home).multiplier;
  const hp = teamStrength(homeXI, home, null) * homeFit * 1.025;
  const ap = teamStrength(awayXI, away, null) * awayFit;
  const benchFor = (club, xi) => {
    const used = new Set(xi.map((player) => player.id));
    return bestXI(
      (club.squad || []).filter((player) => !used.has(player.id)),
      club.formation
    ).slice(0, 7);
  };
  const sim = simulateMatchNarrative({
    homeName: home.name,
    awayName: away.name,
    homeXI,
    awayXI,
    homeStr: hp,
    awayStr: ap,
    homeMentality: home.mentality,
    awayMentality: away.mentality,
    homeBench: benchFor(home, homeXI),
    awayBench: benchFor(away, awayXI)
  });
  const { hg, ag, goalsById, assistsById, injuryMarks } = sim;

  Object.entries(goalsById || {}).forEach(([id, count]) => {
    const player = findPlayerById(game, id);
    if (!player) return;
    ensurePlayerStats(player);
    player.goals += count;
    player.seasonGoals += count;
  });
  Object.entries(assistsById || {}).forEach(([id, count]) => {
    const player = findPlayerById(game, id);
    if (!player) return;
    ensurePlayerStats(player);
    player.assists += count;
    player.seasonAssists += count;
  });

  (injuryMarks || []).forEach((mark) => {
    const player = findPlayerById(game, mark.playerId);
    if (player && !player.injury) {
      injurePlayer(game, player, undefined, findPlayerClub(game, player.id));
    }
  });
  applyDisciplineFromMatch(home.squad || [], sim.discipline || {});
  applyDisciplineFromMatch(away.squad || [], sim.discipline || {});

  const clearSatOut = (squad, ids) => squad.forEach((player) => {
    if (!ids.has(player.id) || !player.suspension) return;
    player.suspension.matchesLeft -= 1;
    if (player.suspension.matchesLeft <= 0) player.suspension = null;
  });
  clearSatOut(home.squad || [], satOutHome);
  clearSatOut(away.squad || [], satOutAway);

  const updateNpcXI = (xi, goals, conceded) => {
    xi.forEach((p) => {
      const real = findPlayerById(game, p.id);
      if (!real) return;
      ensurePlayerStats(real);
      real.games += 1;
      real.seasonGames += 1;
      const scored = goalsById?.[real.id] || 0;
      const assisted = assistsById?.[real.id] || 0;
      real.stamina = clamp((real.stamina || 0) - rand(24, 37), 0, real.maxStamina || 100);
      real.form = clamp((real.form || 60) + (goals > conceded ? 3 : goals === conceded ? 1 : -2), 15, 99);
      real.morale = clamp((real.morale || 60) + (goals > conceded ? 4 : goals === conceded ? 1 : -3), 10, 100);
      const resultBonus = goals > conceded ? 0.35 : goals === conceded ? 0.05 : -0.25;
      const rating = clamp(6.2 + resultBonus + scored * 0.85 + assisted * 0.5 + rand(-20, 20) / 100, 4.5, 10);
      real.ratingSum += rating;
      real.ratingCount += 1;
      refreshPlayerDerived(real);
    });
  };
  const substitutes = (side, club) => (sim.events || [])
    .filter((event) => event.kind === "sub" && event.side === side && event.inPlayerId)
    .map((event) => (club.squad || []).find((player) => player.id === event.inPlayerId))
    .filter(Boolean);
  updateNpcXI([...homeXI, ...substitutes("home", home)], hg, ag);
  updateNpcXI([...awayXI, ...substitutes("away", away)], ag, hg);
  registerSimpleResult(home, away, hg, ag);
  recordNpcIncome(game.state, home, 350 + (home.prestige || 0) * 12 + (hg > ag ? 650 : hg === ag ? 350 : 200), "match");
  recordNpcIncome(game.state, away, ag > hg ? 650 : ag === hg ? 350 : 200, "match");
  fixture.played = true;
  fixture.result = { hg, ag, events: sim.events || [] };
}

function simulateRestOfRound(game, round, playerFixture) {
  game.state.seasonFixtures
    .filter((f) => f.round === round && f !== playerFixture && !f.played)
    .forEach((f) => simulateNpcFixture(game, f));
}

function startNextSeason(game) {
  const table = leagueTable(game);
  const mine = table.find((r) => r.you);
  const champion = table[0];
  const rank = mine?.rank || table.length;
  const reward = rank === 1 ? 7000 : rank <= 3 ? 3500 : rank <= 5 ? 1800 : 900;
  table.filter((row) => !row.you).forEach((row) => {
    const club = game.state.npcs.find((npc) => npc.id === row.id);
    const npcReward = row.rank === 1 ? 7000 : row.rank <= 3 ? 3500 : row.rank <= 5 ? 1800 : 900;
    recordNpcIncome(game.state, club, npcReward, "season");
  });
  game.state.club.bank += reward;
  pushLedger(game, { type: "season", amount: reward, label: `Prêmio temporada (${rank}º)` });
  // meta top half
  const sg = ensureSeasonGoals(game.state);
  sg.progress.rank = rank;
  if (rank <= 4 && !sg.claimed.topHalf) {
    /* resgatável na UI */
  }
  game.state.seasonHistory = game.state.seasonHistory || [];
  game.state.seasonHistory.unshift({
    season: game.state.season,
    rank,
    points: game.state.club.points,
    wins: game.state.club.wins,
    draws: game.state.club.draws,
    losses: game.state.club.losses,
    gf: game.state.club.gf,
    ga: game.state.club.ga,
    champion: champion?.name || "—",
    reward
  });
  if (game.state.seasonHistory.length > 20) game.state.seasonHistory.length = 20;
  if (rank === 1) {
    game.state.trophies = game.state.trophies || [];
    game.state.trophies.push({
      id: `league_${game.state.season}`,
      name: `Liga local — temporada ${game.state.season}`,
      day: game.state.day,
      season: game.state.season
    });
    game.state.club.prestige += 12;
  }

  evolveNpcs(game);
  game.state.season += 1;
  game.state.seasonTheme = SEASON_THEMES[(game.state.season - 1) % SEASON_THEMES.length];
  game.state.seasonGoals = null;
  ensureSeasonGoals(game.state);
  const resetClub = (c) => {
    Object.assign(c, {
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      points: 0,
      cleanSheets: 0,
      form: []
    });
  };
  game.state.npcs.forEach(resetClub);
  resetClub(game.state.club);
  [...game.state.squad, ...game.state.npcs.flatMap((c) => c.squad || [])].forEach((p) => {
    p.seasonGames = 0;
    p.seasonGoals = 0;
    p.seasonAssists = 0;
  });
  generateFixtures(game);
  game.notify(
    `Temporada encerrada em ${rank}º · prêmio R$ ${formatMoney(reward)}. Começa a temporada ${game.state.season}!`,
    rank === 1 ? "info" : "warn"
  );
}

export function playNextMatch(game) {
  let next = getNextFixture(game);
  if (!next) {
    startNextSeason(game);
    next = getNextFixture(game);
  }

  if (game.state.day === game.state.boss.lastMatchDay) {
    return { ok: false, msg: "Já jogou uma partida hoje. O próximo jogo libera quando um novo dia começar." };
  }

  const check = game.canAct(MATCH_ENERGY_COST, 0, { allowLowHealth: true });
  if (!check.ok) return { ok: false, msg: check.reason };

  const { fixture, index } = next;
  const homeClub = game.getClub(fixture.home);
  const awayClub = game.getClub(fixture.away);
  ensureClubStats(homeClub);
  ensureClubStats(awayClub);
  ensureLineup(game.state);
  const homeIsPlayer = fixture.home === game.state.club.id;
  const awayIsPlayer = fixture.away === game.state.club.id;
  const homeXI = homeIsPlayer
    ? getStartingXI(game)
    : bestXI(game.getSquad(fixture.home), homeClub.formation);
  const awayXI = awayIsPlayer
    ? getStartingXI(game)
    : bestXI(game.getSquad(fixture.away), awayClub.formation);
  const playerBench = homeIsPlayer || awayIsPlayer ? getBenchPlayers(game) : [];
  const npcBenchFor = (club, xi) => {
    const used = new Set(xi.map((player) => player.id));
    return bestXI(
      (club.squad || []).filter((player) => !used.has(player.id)),
      club.formation
    ).slice(0, 7);
  };
  const opponentClub = homeIsPlayer ? awayClub : homeClub;

  if (homeIsPlayer && homeXI.length < 11) {
    return { ok: false, msg: "Menos de 11 aptos no XI. Ajuste a escalação." };
  }
  if (awayIsPlayer && awayXI.length < 11) {
    return { ok: false, msg: "Menos de 11 aptos no XI. Ajuste a escalação." };
  }
  if (!homeIsPlayer && homeXI.length < 11) {
    return { ok: false, msg: `${homeClub.name} está sem 11 atletas aptos. A partida foi adiada.` };
  }
  if (!awayIsPlayer && awayXI.length < 11) {
    return { ok: false, msg: `${awayClub.name} está sem 11 atletas aptos. A partida foi adiada.` };
  }

  // Quem já estava suspenso “assiste” este jogo e cumpre 1 pena no fim
  const satOutMine = new Set(
    game.state.squad.filter((p) => p.suspension?.matchesLeft > 0).map((p) => p.id)
  );
  const satOutNpc = new Set(
    (opponentClub.squad || []).filter((p) => p.suspension?.matchesLeft > 0).map((p) => p.id)
  );

  // Energia e “já jogou hoje” aplicados antes da simulação (anti re-roll)
  game.spend(MATCH_ENERGY_COST, 0);
  game.state.boss.lastMatchDay = game.state.day;

  const homeFit = tacticalMatchup(homeClub, awayClub);
  const awayFit = tacticalMatchup(awayClub, homeClub);
  const homeStr = teamStrength(
    homeXI,
    homeClub,
    fixture.home === game.state.club.id ? game.state.boss.stats : null
  ) * homeFit.multiplier * 1.04;
  const awayStr = teamStrength(
    awayXI,
    awayClub,
    fixture.away === game.state.club.id ? game.state.boss.stats : null
  ) * awayFit.multiplier;

  // Simulação atômica: placar + eventos fixos (UI só reproduz)
  const sim = simulateMatchNarrative({
    homeName: homeClub.name,
    awayName: awayClub.name,
    homeXI,
    awayXI,
    homeStr,
    awayStr,
    homeMentality: homeClub.mentality,
    awayMentality: awayClub.mentality,
    homeBench: homeIsPlayer ? playerBench : npcBenchFor(homeClub, homeXI),
    awayBench: awayIsPlayer ? playerBench : npcBenchFor(awayClub, awayXI)
  });
  const { hg, ag, goalsById, assistsById, injuryMarks } = sim;
  const events = sim.events;

  // Aplica gols/assistências reais a partir do snapshot (sem re-simular)
  Object.entries(goalsById).forEach(([id, n]) => {
    const real = findPlayerById(game, id);
    if (!real) return;
    ensurePlayerStats(real);
    real.goals = (real.goals || 0) + n;
    real.seasonGoals = (real.seasonGoals || 0) + n;
  });
  Object.entries(assistsById).forEach(([id, n]) => {
    const real = findPlayerById(game, id);
    if (!real) return;
    ensurePlayerStats(real);
    real.assists = (real.assists || 0) + n;
    real.seasonAssists = (real.seasonAssists || 0) + n;
  });

  // Lesões decididas na simulação — aplicadas uma vez
  injuryMarks.forEach((mark) => {
    const real = findPlayerById(game, mark.playerId);
    if (real && !real.injury) {
      injurePlayer(game, real, undefined, findPlayerClub(game, real.id));
    }
  });

  // Disciplina: vermelho de HOJE → suspenso no PRÓXIMO jogo
  const disc = sim.discipline || { sentOffIds: [], yellowIds: [] };
  applyDisciplineFromMatch(game.state.squad, disc);
  applyDisciplineFromMatch(opponentClub.squad || [], disc);

  // Quem já estava suspenso e ficou de fora nesta rodada cumpre 1 jogo
  const clearSatOut = (squad, satIds) => {
    squad.forEach((p) => {
      if (!satIds.has(p.id) || !p.suspension) return;
      p.suspension.matchesLeft -= 1;
      if (p.suspension.matchesLeft <= 0) {
        game.log(`${p.name} cumpriu suspensão e volta a ficar apto.`, "info");
        p.suspension = null;
      }
    });
  };
  clearSatOut(game.state.squad, satOutMine);
  clearSatOut(opponentClub.squad || [], satOutNpc);

  /** Atualiza elenco (seu ou NPC) com apps, nota, forma */
  const updateXI = (xi, won, drew, goalsConceded) => {
    let best = null;
    let bestRating = -1;
    xi.forEach((shadow) => {
      const p = findPlayerById(game, shadow.id);
      if (!p) return;
      ensurePlayerStats(p);
      p.stamina = clamp(p.stamina - rand(25, 40), 0, p.maxStamina || 100);
      p.form = clamp(p.form + (won ? 4 : drew ? 1 : -3) + rand(-1, 2), 15, 99);
      p.morale = clamp(p.morale + (won ? 5 : drew ? 1 : -4), 10, 100);

      p.games = (p.games || 0) + 1;
      p.seasonGames = (p.seasonGames || 0) + 1;

      const g = goalsById[p.id] || 0;
      const a = assistsById[p.id] || 0;
      let rating = 6.0 + rand(-8, 10) / 10;
      rating += g * 0.85 + a * 0.45;
      if (won) rating += 0.35;
      if (drew) rating += 0.1;
      if (!won && !drew) rating -= 0.25;
      if (["GOL", "ZAG"].includes(p.pos) && goalsConceded === 0) rating += 0.5;
      if (["GOL", "ZAG"].includes(p.pos) && goalsConceded >= 3) rating -= 0.4;
      rating = clamp(Math.round(rating * 10) / 10, 4.0, 10.0);

      p.ratingSum = (p.ratingSum || 0) + rating;
      p.ratingCount = (p.ratingCount || 0) + 1;
      if (rating > bestRating) {
        bestRating = rating;
        best = p;
      }
      refreshPlayerDerived(p);
    });
    if (best && bestRating >= 7.2) {
      best.motm = (best.motm || 0) + 1;
      events.push({
        min: 90,
        kind: "motm",
        drama: true,
        text: `Craque da partida: ${best.name} (${bestRating.toFixed(1)})`
      });
    }
  };

  const homeWon = hg > ag;
  const draw = hg === ag;
  registerSimpleResult(homeClub, awayClub, hg, ag);

  const matchSubstitutes = (side, club) => events
    .filter((event) => event.kind === "sub" && event.side === side && event.inPlayerId)
    .map((event) => (club.id === game.state.club.id ? game.state.squad : club.squad || [])
      .find((player) => player.id === event.inPlayerId))
    .filter(Boolean);
  updateXI([...homeXI, ...matchSubstitutes("home", homeClub)], homeWon, draw, ag);
  updateXI([...awayXI, ...matchSubstitutes("away", awayClub)], !homeWon && !draw, draw, hg);

  const playerIsHome = fixture.home === game.state.club.id;
  const playerWon = playerIsHome ? homeWon : !homeWon && !draw;
  const playerDraw = draw;
  const playerGoals = playerIsHome ? hg : ag;
  const playerConceded = playerIsHome ? ag : hg;
  const playerXI = playerIsHome ? homeXI : awayXI;
  const playerPower = playerIsHome ? homeStr : awayStr;
  const opponentPower = playerIsHome ? awayStr : homeStr;
  let prize = playerWon ? 1100 : playerDraw ? 500 : 250;
  prize += Math.floor(game.state.club.prestige * 2.5);
  const theme = game.state.seasonTheme || SEASON_THEMES[0];
  let themeBonus = 0;
  if (theme.youthBonus && playerXI.filter((p) => p.age <= 21).length >= 3) themeBonus += theme.youthBonus;
  if (theme.goalBonus) themeBonus += playerGoals * theme.goalBonus;
  if (theme.cleanSheetBonus && playerConceded === 0) themeBonus += theme.cleanSheetBonus;
  if (theme.underdogBonus && playerPower < opponentPower && (playerWon || playerDraw)) {
    themeBonus += theme.underdogBonus;
  }
  prize += themeBonus;
  if (playerIsHome) prize += homeGateBonus(game.state.club);
  game.state.club.bank += prize;
  const npcOpponent = playerIsHome ? awayClub : homeClub;
  const npcGoals = playerIsHome ? ag : hg;
  const npcConceded = playerIsHome ? hg : ag;
  const npcMatchIncome =
    (npcGoals > npcConceded ? 650 : npcGoals === npcConceded ? 350 : 200) +
    (!playerIsHome ? 350 + (npcOpponent.prestige || 0) * 12 : 0);
  recordNpcIncome(game.state, npcOpponent, npcMatchIncome, "match");
  pushLedger(game, {
    type: "match",
    amount: prize,
    label: playerWon ? "Prêmio de vitória" : playerDraw ? "Prêmio de empate" : "Prêmio de participação"
  });
  game.state.boss.rep += playerWon ? 4 : playerDraw ? 1 : 0;
  if (!playerWon && !playerDraw) game.state.boss.rep = Math.max(0, game.state.boss.rep - 1);
  game.addXp(playerWon ? 30 : playerDraw ? 15 : 10);

  fixture.played = true;
  fixture.result = { hg, ag, events };
  simulateRestOfRound(game, fixture.round, fixture);
  game.state.nextFixtureIndex = index + 1;

  const resultText = `${homeClub.name} ${hg} x ${ag} ${awayClub.name}`;
  game.state.lastMatch = {
    home: homeClub.name,
    away: awayClub.name,
    hg,
    ag,
    events,
    prize,
    themeBonus,
    day: game.state.day,
    playerWon,
    playerDraw
  };
  game.state.matchLog.unshift(game.state.lastMatch);
  if (game.state.matchLog.length > 30) game.state.matchLog.pop();

  // Pós-jogo do técnico
  const cards = (events || []).filter((e) =>
    ["yellow", "second_yellow", "red"].includes(e.kind)
  );
  game.state.lastPostMatch = {
    home: homeClub.name,
    away: awayClub.name,
    hg,
    ag,
    prize,
    themeBonus,
    playerWon,
    playerDraw,
    day: game.state.day,
    events: (events || []).filter((e) => e.drama || e.kind === "goal" || e.kind === "motm").slice(0, 12),
    cards,
    discipline: disc,
    injuries: injuryMarks,
    xi: (playerIsHome ? homeXI : awayXI).map((p) => ({
      id: p.id,
      name: playerDisplayName(p),
      pos: p.pos,
      overall: p.overall
    }))
  };

  const seasonComplete = !game.state.seasonFixtures.some(
    (f) => !f.played && (f.home === game.state.club.id || f.away === game.state.club.id)
  );
  if (seasonComplete) startNextSeason(game);

  game.notify(`Partida encerrada · +R$ ${formatMoney(prize)} no caixa.`, playerWon ? "info" : "warn");
  game.feed(resultText);
  game.commit();

  const live = buildLiveSnapshot({
    mode: "league",
    home: homeClub.name,
    away: awayClub.name,
    hg,
    ag,
    events,
    subtitle: `Liga · ${homeFit.reasons?.[0] || "confronto"}`,
    footer: `+R$ ${formatMoney(prize)}${themeBonus ? ` · tema +R$ ${formatMoney(themeBonus)}` : ""}`
  });
  game.state.liveMatch = live;

  return { ok: true, match: game.state.lastMatch, live, postMatch: game.state.lastPostMatch };
}

/** Classificação da liga (pontos) + métricas extras para UI legada */
export function leagueTable(game) {
  return clubRankings(game, "pts").map((r) => ({
    rank: r.rank,
    id: r.id,
    name: r.name,
    pts: r.pts,
    w: r.w,
    d: r.d,
    l: r.l,
    gf: r.gf,
    ga: r.ga,
    gd: r.gd,
    you: r.you,
    gpg: r.gpg,
    ppg: r.ppg,
    perf: r.perf,
    cleanSheets: r.cleanSheets,
    form: r.form
  }));
}
