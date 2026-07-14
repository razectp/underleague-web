/**
 * Factory do estado inicial de uma campanha.
 */

import { VERSION, STYLES, PRACAS, CLUB_TYPES, STANDARD_OPPONENTS, SEASON_THEMES } from "../config/constants.js";
import { generatePlayer, generateSquad, generateSquadAtOverall, playerName, refreshPlayerDerived } from "../data/generators.js";
import { emptyBossSkillXp } from "../systems/skillProgress.js";
import { ensureNpcAiState } from "../systems/npcAi.js";
import { rand, uid } from "../core/utils.js";

function emptyRecord() {
  return { wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0 };
}

export function playerNameKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function statePlayers(state) {
  if (!state || typeof state !== "object") return [];
  return [
    ...(Array.isArray(state.squad) ? state.squad : []),
    ...(Array.isArray(state.npcs) ? state.npcs.flatMap((club) => club.squad || []) : []),
    ...(Array.isArray(state.market) ? state.market : [])
  ];
}

function stripLegacyGeneratedNickname(player) {
  if (!player || typeof player.name !== "string") return;
  const match = player.name.trim().match(/^(.*?)\s+["“]([^"”]+)["”]\s*$/u);
  if (match) player.name = match[1].trim();
  if (player.nickname === undefined) player.nickname = null;
}

function ensureUniquePlayerNames(groups, reservedNames = []) {
  const used = new Set(reservedNames.map(playerNameKey).filter(Boolean));
  for (const group of groups) {
    for (const player of group) {
      stripLegacyGeneratedNickname(player);
      let candidate = player.name;
      let key = playerNameKey(candidate);
      for (let attempt = 0; (!key || used.has(key)) && attempt < 10_000; attempt++) {
        candidate = playerName();
        key = playerNameKey(candidate);
      }
      if (!key || used.has(key)) {
        throw new Error("Não foi possível gerar uma identidade exclusiva para o atleta.");
      }
      player.name = candidate;
      used.add(key);
    }
  }
}

export function ensureUniquePlayerNamesInState(state, reservedNames = []) {
  if (!state || typeof state !== "object") return state;
  ensureUniquePlayerNames([
    Array.isArray(state.squad) ? state.squad : [],
    ...(Array.isArray(state.npcs) ? state.npcs.map((club) => club.squad || []) : []),
    Array.isArray(state.market) ? state.market : []
  ], [
    state.boss?.name,
    ...statePlayers(state).map((player) => player.nickname),
    ...reservedNames
  ]);
  return state;
}

/**
 * @param {{ name: string, clubName: string, style?: string, clubType?: string }} opts
 * name = presidente/técnico · clubName = o TIME que a pessoa funda
 */
export function createInitialState({ name, clubName: clubLabel, style, clubType }) {
  const styleStats = STYLES[style] || STYLES.equilibrio;
  const type = CLUB_TYPES[clubType] || CLUB_TYPES.bairro;
  const clubId = uid();
  const bossId = uid();

  const club = {
    id: clubId,
    name: clubLabel,
    type: type.id,
    typeLabel: type.label,
    motto: type.blurb,
    bank: type.startBank,
    prestige: type.id === "escolinha" ? 12 : type.id === "clube" ? 25 : 18,
    members: [{ id: bossId, name, role: "presidente" }],
    formation: "4-3-3",
    mentality: "equilibrado",
    approach: "posse",
    influence: { zsul: 35, periferia: 12 },
    academyLevel: type.id === "escolinha" ? 2 : 1,
    facilities: { training: type.id === "clube" ? 2 : 1, medical: 1, stadium: 1 },
    ...emptyRecord()
  };

  // Elenco inicial = a "turma" da escolinha/time (forma alta = early game confiante)
  let squad = generateSquad(clubId, type.squadQuality, 16);
  squad.forEach((p) => {
    p.form = Math.min(94, Math.max(p.form, rand(74, 90)));
    p.morale = Math.min(94, Math.max(p.morale, rand(72, 90)));
    p.maxStamina = 110;
    p.stamina = 110;
  });
  if (type.youthBias) {
    squad = squad.map((p) => {
      // base mais jovem
      if (p.age > 24 && rand(1, 100) <= 70) {
        p.age = rand(16, 22);
        p.potential = Math.min(98, (p.potential || 60) + rand(2, 8));
      }
      return p;
    });
  }
  const npcs = STANDARD_OPPONENTS.map((def, i) => {
    const id = uid();
    const rivalSquad = generateSquadAtOverall(id, def.targetOverall, def.approach, 16);
    rivalSquad.forEach((p) => {
      p.form = Math.min(92, 46 + i * 6 + rand(-2, 2));
      p.morale = Math.min(92, 48 + i * 6 + rand(-2, 2));
    });
    return {
      id,
      circuitId: def.id,
      difficulty: i + 1,
      name: def.name,
      bank: 5000 + i * 2500,
      prestige: 10 + i * 6,
      members: [],
      formation: def.formation,
      mentality: def.mentality,
      approach: def.approach,
      description: def.desc,
      lesson: def.lesson,
      influence: {},
      ...emptyRecord(),
      npc: true,
      squad: rivalSquad
    };
  });

  PRACAS.forEach((p, i) => {
    npcs[i % npcs.length].influence[p.id] = rand(38, 65);
    npcs[(i + 2) % npcs.length].influence[p.id] = rand(12, 32);
  });

  const market = [];
  for (let i = 0; i < 24; i++) {
    const player = generatePlayer({ tier: i < 5 ? 1 : rand(1, 5), onMarket: true, clubId: null });
    if (i < 5) player.marketPrice = Math.floor(player.value * (0.7 + i * 0.05));
    if (i === 0) player.marketPrice = Math.min(player.marketPrice, 4500);
    market.push(player);
  }

  // Cada atleta desta campanha tem identidade própria, inclusive nos rivais e mercado.
  ensureUniquePlayerNamesInState({ boss: { name }, squad, npcs, market });

  return {
    version: VERSION,
    day: 1,
    hour: 8,
    season: 1,
    seasonTheme: SEASON_THEMES[0],
    boss: {
      id: bossId,
      name: name.trim().slice(0, 20),
      money: 6500,
      energy: 120,
      maxEnergy: 120,
      rep: 20,
      xp: 0,
      level: 1,
      stats: { ...styleStats },
      skillXp: emptyBossSkillXp(),
      injury: null,
      health: 100,
      restDebt: 0,
      lastMatchDay: 0,
      cooldowns: {},
      style
    },
    club,
    squad,
    npcs,
    market,
    matchLog: [],
    lastMatch: null,
    feed: [],
    chronicles: [],
    seasonFixtures: [],
    nextFixtureIndex: 0,
    seasonHistory: [],
    trophies: [],
    circuit: {
      tour: 1,
      tourBasePower: null,
      unlocked: 1,
      totalWins: 0,
      records: {},
      lastMatch: null,
      history: []
    },
    missions: null, // preenchido por ensureDailyMissions
    lineup: { starters: [], bench: [], auto: true },
    ledger: [],
    seasonGoals: null,
    lastPostMatch: null,
    tutorial: { step: 0, done: false },
    serverClockAt: Date.now(),
    createdAt: Date.now(),
    savedAt: Date.now()
  };
}

export function migrateState(state) {
  const fromVersion = state.version || 1;
  if (!state.version) state.version = 1;
  state.version = Math.max(state.version || 1, VERSION);
  if (!state.feed) state.feed = [];
  if (!state.chronicles) state.chronicles = [];
  if (!state.matchLog) state.matchLog = [];
  if (state.missions === undefined) state.missions = null;
  if (state.boss && !state.boss.skillXp) {
    state.boss.skillXp = emptyBossSkillXp();
  }
  if (state.club && !state.club.type) {
    state.club.type = "bairro";
    state.club.typeLabel = "Time de bairro / amador";
    state.club.motto = "Seu clube, seu elenco, sua rivalidade.";
    state.club.academyLevel = state.club.academyLevel || 1;
  }
  if (state.club && !state.club.approach) state.club.approach = "posse";
  if (!state.seasonHistory) state.seasonHistory = [];
  if (!state.seasonTheme) state.seasonTheme = SEASON_THEMES[(Math.max(1, state.season || 1) - 1) % SEASON_THEMES.length];
  if (!state.trophies) state.trophies = [];
  if (fromVersion < 6 || !Number.isFinite(state.serverClockAt)) {
    // Saves existentes começam a contar do primeiro acesso após a atualização;
    // nunca inferimos tempo offline a partir de um timestamp antigo ou do cliente.
    state.serverClockAt = Date.now();
  }
  if (fromVersion < 4) {
    const migrateInfluence = (club) => {
      club.influence = club.influence || {};
      (club.territories || []).forEach((id) => {
        club.influence[id] = Math.max(club.influence[id] || 0, 55);
      });
      delete club.territories;
    };
    if (state.club) migrateInfluence(state.club);
    (state.npcs || []).forEach(migrateInfluence);
    if (state.boss?.cooldowns?.territory) {
      state.boss.cooldowns.influence = state.boss.cooldowns.territory;
      delete state.boss.cooldowns.territory;
    }
    (state.missions?.items || []).forEach((m) => {
      if (m.type === "territory") {
        m.type = "influence";
        m.label = "Fortaleça a influência em uma região";
      }
    });
  }
  if (state.club && !state.club.influence) state.club.influence = {};
  // Saves da antiga mecânica territorial tinham um único dono por região.
  // Garante coexistência real sem apagar a presença já conquistada.
  if (state.club && Array.isArray(state.npcs)) {
    const clubs = [state.club, ...state.npcs];
    PRACAS.forEach((praca, i) => {
      const active = clubs.filter((club) => (club.influence?.[praca.id] || 0) > 0);
      if (active.length >= 2) return;
      const candidate = state.npcs[(i + 2) % Math.max(1, state.npcs.length)];
      if (!candidate) return;
      candidate.influence = candidate.influence || {};
      candidate.influence[praca.id] = Math.max(candidate.influence[praca.id] || 0, 20);
    });
  }
  if (fromVersion < 3) {
    // A v3 usa calendário completo; partidas antigas tinham números de jogos desiguais.
    state.seasonFixtures = [];
    state.nextFixtureIndex = 0;
  }
  if (!state.circuit) {
    state.circuit = {
      tour: 1,
      tourBasePower: null,
      unlocked: 1,
      totalWins: 0,
      records: {},
      lastMatch: null,
      history: []
    };
  }
  state.circuit.tour = Math.max(1, state.circuit.tour || 1);
  state.circuit.unlocked = Math.max(1, state.circuit.unlocked || 1);
  state.circuit.records = state.circuit.records || {};
  state.circuit.history = state.circuit.history || [];

  // Garante todos os rivais do catálogo (saves antigos recebem clubes novos).
  {
    if (!Array.isArray(state.npcs)) state.npcs = [];
    const byCircuit = new Map(
      state.npcs.filter((n) => n.circuitId).map((n) => [n.circuitId, n])
    );
    let expanded = false;
    STANDARD_OPPONENTS.forEach((def, i) => {
      let npc = byCircuit.get(def.id);
      if (!npc) {
        const id = uid();
        const rivalSquad = generateSquadAtOverall(id, def.targetOverall, def.approach, 16);
        rivalSquad.forEach((p) => {
          p.form = Math.min(92, 50 + i * 2);
          p.morale = Math.min(92, 52 + i * 2);
        });
        npc = {
          id,
          circuitId: def.id,
          difficulty: i + 1,
          name: def.name,
          bank: 5000 + i * 2200,
          prestige: 10 + i * 4,
          members: [],
          formation: def.formation,
          mentality: def.mentality,
          approach: def.approach,
          description: def.desc,
          lesson: def.lesson,
          influence: {},
          ...emptyRecord(),
          npc: true,
          squad: rivalSquad
        };
        state.npcs.push(npc);
        byCircuit.set(def.id, npc);
        expanded = true;
      } else {
        npc.circuitId = def.id;
        npc.difficulty = i + 1;
        npc.name = def.name;
        npc.formation = npc.formation || def.formation;
        npc.mentality = npc.mentality || def.mentality;
        npc.approach = npc.approach || def.approach;
        npc.description = npc.description || def.desc;
        npc.lesson = npc.lesson || def.lesson;
        npc.npc = true;
      }
    });
    // Ordem estável do catálogo; clubes órfãos (sem circuitId) ficam no fim.
    const catalog = STANDARD_OPPONENTS.map((d) => byCircuit.get(d.id)).filter(Boolean);
    const orphans = state.npcs.filter((n) => !n.circuitId || !byCircuit.has(n.circuitId));
    // Dedupe: keep catalog order only for known ids
    const seen = new Set();
    state.npcs = [];
    for (const n of catalog) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      state.npcs.push(n);
    }
    for (const n of orphans) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      state.npcs.push(n);
    }
    if (expanded || fromVersion < 9) {
      // Liga redimensionada: calendário e tabela da temporada atual recomeçam.
      state.seasonFixtures = [];
      state.nextFixtureIndex = 0;
      const resetSeason = (club) => Object.assign(club, emptyRecord());
      if (state.club) resetSeason(state.club);
      state.npcs.forEach(resetSeason);
    }
  }
  if (Array.isArray(state.squad)) {
    state.squad.forEach((p) => {
      stripLegacyGeneratedNickname(p);
      if (!p.attrXp) {
        p.attrXp = { pace: 0, shoot: 0, pass: 0, defend: 0, physical: 0 };
      }
      if (p.seasonYellows == null) p.seasonYellows = 0;
      if (p.suspension === undefined) p.suspension = null;
      if (p.contractYears == null) p.contractYears = rand(1, 4);
      if (!Number.isFinite(p.maxStamina)) p.maxStamina = 100;
      refreshPlayerDerived(p);
      if (fromVersion < 3 || !Number.isFinite(p.salary)) {
        p.salary = Math.max(35, Math.floor((p.value || 0) / 55));
      }
    });
  }
  if (!state.lineup) state.lineup = { starters: [], bench: [], auto: true };
  if (!state.ledger) state.ledger = [];
  if (!state.tutorial) state.tutorial = { step: 0, done: false };
  ensureNpcAiState(state);
  if (state.club && !state.club.facilities) {
    state.club.facilities = { training: 1, medical: 1, stadium: 1 };
  }
  if (Array.isArray(state.npcs)) {
    state.npcs.flatMap((c) => c.squad || []).forEach((p) => {
      stripLegacyGeneratedNickname(p);
      refreshPlayerDerived(p);
      if (fromVersion < 3 || !Number.isFinite(p.salary)) {
        p.salary = Math.max(35, Math.floor((p.value || 0) / 55));
      }
    });
  }
  if (Array.isArray(state.market)) {
    state.market.forEach((p) => {
      stripLegacyGeneratedNickname(p);
      refreshPlayerDerived(p);
      if (fromVersion < 3 || !Number.isFinite(p.salary)) {
        p.salary = Math.max(35, Math.floor((p.value || 0) / 55));
      }
      if (p.onMarket && fromVersion < 5) p.marketPrice = Math.floor(p.value * 1.05);
    });
  }
  ensureUniquePlayerNamesInState(state);
  return state;
}
