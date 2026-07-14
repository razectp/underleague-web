import { CIRCUIT_ENERGY_COST, STANDARD_OPPONENTS } from "../config/constants.js";
import { chance, clamp, formatMoney, pick, rand } from "../core/utils.js";
import { advanceHours } from "./time.js";
import { bestXI, tacticalMatchup, teamStrength } from "./tactics.js";
import { simulateMatchNarrative, buildLiveSnapshot } from "./matchSim.js";
import { applyDisciplineFromMatch } from "./availability.js";
import { injurePlayer } from "./injuries.js";
import { getStartingXI, getBenchPlayers } from "./lineup.js";
import { pushLedger } from "./finance.js";

function ensureCircuit(state) {
  state.circuit = state.circuit || {
    tour: 1,
    tourBasePower: null,
    unlocked: 1,
    totalWins: 0,
    records: {},
    lastMatch: null,
    history: []
  };
  return state.circuit;
}

function rivalDefinition(rival) {
  return STANDARD_OPPONENTS.find((x) => x.id === rival.circuitId);
}

function recordKey(tour, id) {
  return `${tour}:${id}`;
}

export function circuitStatus(game) {
  const circuit = ensureCircuit(game.state);
  const myXI = bestXI(game.state.squad, game.state.club.formation);
  const currentPower = teamStrength(myXI, game.state.club, game.state.boss.stats);
  if (!circuit.tourBasePower) circuit.tourBasePower = Math.round(currentPower);
  // Escada fácil no começo da volta; o “chefe” ainda pressiona
  const offsets = [-28, -18, -11, -4, 3, 10, 17];
  const prestigeStep = Math.min(10, (circuit.tour - 1) * 1.25);
  const rivals = [...game.state.npcs]
    .filter((c) => c.circuitId)
    .sort((a, b) => a.difficulty - b.difficulty)
    .map((rival) => {
      const def = rivalDefinition(rival);
      const xi = bestXI(rival.squad, rival.formation);
      const basePower = teamStrength(xi, rival, null);
      const desiredPower = Math.max(
        35,
        circuit.tourBasePower + (offsets[rival.difficulty - 1] || 0) + prestigeStep
      );
      const powerScale = desiredPower / Math.max(1, basePower);
      const rec = circuit.records[recordKey(circuit.tour, rival.circuitId)] || {
        played: 0,
        wins: 0,
        bestStars: 0
      };
      return {
        rival,
        def,
        record: rec,
        unlocked: rival.difficulty <= circuit.unlocked,
        estimatedPower: Math.round(desiredPower),
        tourScale: powerScale
      };
    });
  return { circuit, rivals };
}

function scorer(xi) {
  const attackers = xi.filter((p) => ["ATA", "PE", "PD", "MEI"].includes(p.pos));
  return pick(attackers.length ? attackers : xi)?.name || "Jogador";
}

function rollCircuitScore(myXI, rivalXI, myPower, rivalPower, myClub, rival) {
  let mine = 0;
  let theirs = 0;
  const events = [];
  const share = myPower / Math.max(1, myPower + rivalPower);

  for (let i = 0; i < 18; i++) {
    if (!chance(46)) continue;
    const minute = clamp(4 + i * 5 + rand(-2, 2), 1, 90);
    const mineAttacks = chance(share * 100);
    const attackPower = mineAttacks ? myPower : rivalPower;
    const defendPower = mineAttacks ? rivalPower : myPower;
    // Conversão levemente a favor do atacante mais forte → vitórias limpas no early
  let conversion = 26 + (attackPower - defendPower) * 0.38;
    const attackMentality = mineAttacks ? myClub.mentality : rival.mentality;
    const defendMentality = mineAttacks ? rival.mentality : myClub.mentality;
    if (attackMentality === "ataque") conversion += 5;
    if (defendMentality === "defesa") conversion -= 5;
    if (!chance(clamp(conversion, 8, 45))) continue;
    if (mineAttacks) {
      mine += 1;
      events.push({ min: minute, text: `GOL! ${scorer(myXI)} (${myClub.name})` });
    } else {
      theirs += 1;
      events.push({ min: minute, text: `Gol de ${scorer(rivalXI)} (${rival.name})` });
    }
  }
  return { mine, theirs, events: events.sort((a, b) => a.min - b.min) };
}

export function playCircuitMatch(game, rivalId) {
  const { circuit, rivals } = circuitStatus(game);
  const entry = rivals.find((x) => x.rival.circuitId === rivalId || x.rival.id === rivalId);
  if (!entry) return { ok: false, msg: "Rival do circuito não encontrado." };
  if (!entry.unlocked) return { ok: false, msg: "Vença o rival anterior para desbloquear este confronto." };
  if (game.cooldownLeft("circuit") > 0) {
    return { ok: false, msg: `Circuito em recuperação (${game.cooldownLeft("circuit")}h).` };
  }
  const check = game.canAct(CIRCUIT_ENERGY_COST, 0, { allowLowHealth: true });
  if (!check.ok) return { ok: false, msg: check.reason };

  const myXI = getStartingXI(game);
  const myBench = getBenchPlayers(game);
  const rivalXI = bestXI(entry.rival.squad, entry.rival.formation);
  if (myXI.length < 11) {
    return { ok: false, msg: "Você precisa de 11 no XI (ajuste a escalação)." };
  }

  const satOut = new Set(
    game.state.squad.filter((p) => p.suspension?.matchesLeft > 0).map((p) => p.id)
  );

  const matchup = tacticalMatchup(game.state.club, entry.rival);
  const myPower = teamStrength(myXI, game.state.club, game.state.boss.stats) * matchup.multiplier;
  const rivalPower = teamStrength(rivalXI, entry.rival, null) * entry.tourScale;

  // Custo + CD antes da simulação (impede spam / re-roll)
  game.spend(CIRCUIT_ENERGY_COST, 0);
  game.setCooldown("circuit", 3);

  const sim = simulateMatchNarrative({
    homeName: game.state.club.name,
    awayName: entry.rival.name,
    homeXI: myXI,
    awayXI: rivalXI,
    homeStr: myPower,
    awayStr: rivalPower,
    homeMentality: game.state.club.mentality,
    awayMentality: entry.rival.mentality,
    homeBench: myBench,
    awayBench: []
  });
  const score = { mine: sim.hg, theirs: sim.ag, events: sim.events };

  // Lesões reais no elenco (raras — budget da sim)
  sim.injuryMarks.forEach((mark) => {
    const p = game.state.squad.find((x) => x.id === mark.playerId);
    if (p && !p.injury) injurePlayer(game, p);
  });
  const disc = sim.discipline || { sentOffIds: [], yellowIds: [] };
  applyDisciplineFromMatch(game.state.squad, disc);
  game.state.squad.forEach((p) => {
    if (!satOut.has(p.id) || !p.suspension) return;
    p.suspension.matchesLeft -= 1;
    if (p.suspension.matchesLeft <= 0) {
      game.log(`${p.name} cumpriu suspensão e volta a ficar apto.`, "info");
      p.suspension = null;
    }
  });

  const won = score.mine > score.theirs;
  const drew = score.mine === score.theirs;
  const youthObjective = myXI.filter((p) => p.age <= 21).length >= 2;
  const objectives = {
    win: won,
    cleanSheet: score.theirs === 0,
    development: youthObjective
  };
  const stars = Object.values(objectives).filter(Boolean).length;

  myXI.forEach((shadow) => {
    const p = game.state.squad.find((x) => x.id === shadow.id);
    if (!p) return;
    p.stamina = clamp(p.stamina - rand(12, 20), 0, 100);
    p.form = clamp(p.form + (won ? 2 : drew ? 0 : -1), 15, 99);
    p.morale = clamp(p.morale + (won ? 3 : drew ? 1 : -2), 10, 100);
  });

  const key = recordKey(circuit.tour, entry.rival.circuitId);
  const rec = (circuit.records[key] = circuit.records[key] || {
    played: 0,
    wins: 0,
    bestStars: 0
  });
  const firstWin = won && rec.wins === 0;
  rec.played += 1;
  if (won) rec.wins += 1;
  rec.bestStars = Math.max(rec.bestStars, stars);

  const baseReward = entry.def?.reward || 500;
  const reward = won
    ? Math.floor((firstWin ? baseReward : baseReward * 0.28) * (1 + (circuit.tour - 1) * 0.22))
    : drew
      ? 160
      : 80;
  game.state.club.bank += reward;
  pushLedger(game, { type: "circuit", amount: reward, label: `Circuito vs ${entry.rival.name}` });
  game.state.boss.rep += won ? 2 + entry.rival.difficulty : drew ? 1 : 0;
  game.addXp(won ? 16 + entry.rival.difficulty * 3 : drew ? 8 : 4);

  const playedTour = circuit.tour;
  if (won) {
    circuit.totalWins += 1;
    circuit.unlocked = Math.max(circuit.unlocked, entry.rival.difficulty + 1);
  }

  const match = {
    rivalId: entry.rival.circuitId,
    rival: entry.rival.name,
    mine: score.mine,
    theirs: score.theirs,
    events: score.events,
    objectives,
    stars,
    reward,
    won,
    drew,
    tour: playedTour,
    day: game.state.day,
    tacticalNote: matchup.reasons.join("; ")
  };
  circuit.lastMatch = match;
  circuit.history.unshift(match);
  if (circuit.history.length > 40) circuit.history.length = 40;

  if (won && entry.rival.difficulty === rivals.length) {
    game.state.trophies.push({
      id: `circuit_${playedTour}`,
      name: `Circuito de Treino — volta ${playedTour}`,
      day: game.state.day,
      season: game.state.season
    });
    circuit.tour += 1;
    circuit.unlocked = 1;
    circuit.tourBasePower = null;
    game.feed(`${game.state.club.name} concluiu a volta ${playedTour} do Circuito! Rivais mais fortes chegaram.`);
  }

  advanceHours(game, 2, true);
  const starTxt = stars === 3 ? " ★★★ perfeito!" : ` · ${stars}/3 estrelas`;
  game.notify(
    `Circuito registrado · +R$ ${formatMoney(reward)}${starTxt}`,
    won ? "info" : drew ? "warn" : "bad"
  );
  game.commit();

  const live = buildLiveSnapshot({
    mode: "circuit",
    home: game.state.club.name,
    away: entry.rival.name,
    hg: score.mine,
    ag: score.theirs,
    events: score.events,
    subtitle: `Circuito · volta ${playedTour} · ${matchup.reasons.join("; ")}`,
    footer: `+R$ ${formatMoney(reward)}${starTxt} · objetivos ${stars}/3`
  });
  game.state.liveMatch = live;

  return { ok: true, match, live };
}
