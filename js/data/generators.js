/**
 * Geração de jogadores, elencos e nomes.
 * Usado na criação de campanha e no mercado.
 */

import { POSITIONS } from "../config/constants.js";
import {
  FIRST_NAMES,
  LAST_NAMES,
  NICKS,
  CLUB_PREFIX,
  CLUB_SUFFIX
} from "../config/names.js";
import { rand, pick, chance, clamp, uid } from "../core/utils.js";

export function playerName() {
  const nick = chance(18) ? ` "${pick(NICKS)}"` : "";
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}${nick}`;
}

/** Nome curto para a identidade do dirigente, separado dos atletas do elenco. */
export function managerName() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (name.length <= 20) return name;
  }
  return pick(FIRST_NAMES).slice(0, 20);
}

export function clubName() {
  return `${pick(CLUB_PREFIX)} ${pick(CLUB_SUFFIX)}`;
}

export function posOverall(p) {
  const w = {
    GOL: { def: 0.45, fis: 0.25, pas: 0.15, pac: 0.05, sho: 0.1 },
    ZAG: { def: 0.4, fis: 0.3, pas: 0.15, pac: 0.1, sho: 0.05 },
    LAT: { pac: 0.3, def: 0.25, pas: 0.2, fis: 0.15, sho: 0.1 },
    VOL: { def: 0.3, pas: 0.25, fis: 0.25, pac: 0.1, sho: 0.1 },
    MEI: { pas: 0.35, sho: 0.2, pac: 0.15, fis: 0.15, def: 0.15 },
    PE: { pac: 0.3, sho: 0.25, pas: 0.25, fis: 0.1, def: 0.1 },
    PD: { pac: 0.3, sho: 0.25, pas: 0.25, fis: 0.1, def: 0.1 },
    ATA: { sho: 0.4, pac: 0.25, fis: 0.15, pas: 0.15, def: 0.05 }
  }[p.pos] || { pac: 0.2, sho: 0.2, pas: 0.2, def: 0.2, fis: 0.2 };

  return Math.round(
    p.pace * w.pac +
      p.shoot * w.sho +
      p.pass * w.pas +
      p.defend * w.def +
      p.physical * w.fis
  );
}

export function calcValue(p) {
  const ovr = p.overall || posOverall(p);
  const ageFactor = p.age <= 23 ? 1.35 : p.age <= 28 ? 1.15 : p.age <= 32 ? 0.9 : 0.55;
  const formFactor = 0.85 + (p.form / 100) * 0.3;
  const base = Math.pow(ovr, 2.15) * 3;
  return Math.max(500, Math.floor(base * ageFactor * formFactor));
}

export function refreshPlayerDerived(p) {
  p.overall = posOverall(p);
  p.value = calcValue(p);
  return p;
}

export function generatePlayer(opts = {}) {
  const pos = opts.pos || pick(POSITIONS);
  const age = opts.age ?? rand(17, 34);
  const tier = opts.tier ?? rand(1, 5);
  const base = 28 + tier * 8 + rand(-4, 6);
  const peak = age < 24 ? 0.9 : age < 30 ? 1 : age < 33 ? 0.92 : 0.78;

  const skew = {
    GOL: { pace: 0.7, shoot: 0.5, pass: 0.9, defend: 1.35, physical: 1.15 },
    ZAG: { pace: 0.85, shoot: 0.55, pass: 0.9, defend: 1.3, physical: 1.2 },
    LAT: { pace: 1.25, shoot: 0.75, pass: 1.05, defend: 1.05, physical: 1.0 },
    VOL: { pace: 0.95, shoot: 0.8, pass: 1.1, defend: 1.15, physical: 1.15 },
    MEI: { pace: 1.0, shoot: 1.05, pass: 1.3, defend: 0.85, physical: 0.95 },
    PE: { pace: 1.3, shoot: 1.15, pass: 1.1, defend: 0.7, physical: 0.9 },
    PD: { pace: 1.3, shoot: 1.15, pass: 1.1, defend: 0.7, physical: 0.9 },
    ATA: { pace: 1.15, shoot: 1.35, pass: 0.9, defend: 0.55, physical: 1.05 }
  }[pos];

  const roll = (s) => clamp(Math.round((base + rand(-8, 8)) * s * peak), 25, 96);

  const p = {
    id: uid(),
    name: opts.name || playerName(),
    pos,
    age,
    pace: roll(skew.pace),
    shoot: roll(skew.shoot),
    pass: roll(skew.pass),
    defend: roll(skew.defend),
    physical: roll(skew.physical),
    form: opts.form ?? rand(55, 88),
    morale: opts.morale ?? rand(50, 85),
    stamina: 100,
    injury: null,
    suspension: null,
    seasonYellows: 0,
    contractYears: opts.contractYears ?? rand(1, 4),
    games: 0,
    goals: 0,
    assists: 0,
    clubId: opts.clubId || null,
    onMarket: !!opts.onMarket,
    marketPrice: 0,
    potential: clamp(base + rand(5, 25), 40, 98)
  };

  refreshPlayerDerived(p);
  // A folha precisa caber na economia inicial. O valor continua pesando,
  // mas um elenco básico não quebra o clube na primeira semana.
  p.salary = Math.max(35, Math.floor(p.value / 55));
  if (p.onMarket) {
    p.marketPrice = Math.floor(p.value * (0.9 + Math.random() * 0.35));
  }
  return p;
}

export function generateSquad(clubId, quality = 3, size = 16) {
  const needs = [
    "GOL", "GOL", "ZAG", "ZAG", "ZAG", "LAT", "LAT", "VOL", "VOL",
    "MEI", "MEI", "PE", "PD", "ATA", "ATA", "MEI"
  ];
  const squad = [];
  for (let i = 0; i < size; i++) {
    const pos = needs[i] || pick(POSITIONS);
    const tier = clamp(quality + rand(-1, 1), 1, 5);
    squad.push(generatePlayer({ pos, tier, clubId }));
  }
  return squad;
}

/** Gera um elenco próximo de um OVR-alvo e aplica uma identidade de jogo. */
export function generateSquadAtOverall(clubId, targetOverall, approach = "direto", size = 16) {
  const estimatedTier = clamp(Math.round((targetOverall - 28) / 8), 1, 5);
  const squad = generateSquad(clubId, estimatedTier, size);

  squad.forEach((p) => {
    const delta = targetOverall - p.overall + rand(-2, 2);
    const add = (key, extra = 0) => {
      p[key] = clamp(p[key] + delta + extra, 25, 96);
    };
    add("pace", approach === "pressao" ? 3 : approach === "contra_ataque" ? 2 : 0);
    add("shoot", approach === "direto" ? 3 : 0);
    add("pass", approach === "posse" ? 4 : 0);
    add("defend", approach === "contra_ataque" ? 3 : approach === "pressao" ? 1 : 0);
    add("physical", approach === "pressao" || approach === "direto" ? 3 : 0);
    refreshPlayerDerived(p);
    p.salary = Math.max(35, Math.floor(p.value / 55));
  });

  return squad;
}
