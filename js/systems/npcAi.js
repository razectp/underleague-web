/**
 * Gestão determinística dos clubes NPC.
 *
 * Um ciclo por dia de jogo (idempotente). Economia fechada: personalidade só
 * muda o apetite de gastar, nunca cria dinheiro fora dos canais auditados.
 *
 * Calendário da comissão: recuperação/finanças sempre; treino XOR mercado
 * (salvo urgência de elenco). DNA tático estável; rotação de XI por stamina.
 */

import {
  FORMATIONS,
  MARKET_FEE_RATE,
  SQUAD_MAX,
  SQUAD_MIN
} from "../config/constants.js";
import { calcValue, refreshPlayerDerived } from "../data/generators.js";
import { clamp } from "../core/utils.js";
import { isPlayerAvailable } from "./availability.js";
import { bestXI, teamStrength } from "./tactics.js";

/** Dias mínimos entre ações de mercado do mesmo clube (catch-up seguro). */
const MARKET_COOLDOWN_DAYS = 3;

const PERSONALITIES = {
  campinho: { id: "formador", aggression: 0.7, youth: 1, trading: 0.35, reserve: 0.28 },
  uniao_bairro: { id: "tradicional", aggression: 0.45, youth: 0.45, trading: 0.4, reserve: 0.3 },
  muralha_vila: { id: "pragmatico", aggression: 0.2, youth: 0.35, trading: 0.3, reserve: 0.38 },
  ferroviario: { id: "intenso", aggression: 0.7, youth: 0.5, trading: 0.55, reserve: 0.3 },
  academia_central: { id: "analitico", aggression: 0.45, youth: 0.8, trading: 0.65, reserve: 0.35 },
  litoral_veloz: { id: "ousado", aggression: 0.85, youth: 0.6, trading: 0.7, reserve: 0.25 },
  porto_imperial: { id: "ambicioso", aggression: 0.6, youth: 0.45, trading: 0.85, reserve: 0.4 },
  estrela_norte: { id: "modesto", aggression: 0.35, youth: 0.55, trading: 0.35, reserve: 0.36 },
  riacho_fc: { id: "vertical", aggression: 0.65, youth: 0.5, trading: 0.5, reserve: 0.3 },
  forja_industrial: { id: "fisico", aggression: 0.55, youth: 0.3, trading: 0.4, reserve: 0.34 },
  colina_verde: { id: "paciencia", aggression: 0.4, youth: 0.7, trading: 0.55, reserve: 0.36 },
  maritimo_sul: { id: "pressing", aggression: 0.8, youth: 0.55, trading: 0.6, reserve: 0.28 },
  catedral_sc: { id: "classico", aggression: 0.5, youth: 0.45, trading: 0.5, reserve: 0.35 },
  atlas_metropole: { id: "resultado", aggression: 0.7, youth: 0.35, trading: 0.75, reserve: 0.32 },
  orion_capital: { id: "elite", aggression: 0.65, youth: 0.5, trading: 0.7, reserve: 0.38 }
};

const DEFAULT_PERSONALITY = {
  id: "equilibrado",
  aggression: 0.5,
  youth: 0.5,
  trading: 0.5,
  reserve: 0.33
};

function hash32(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededUnit(seed) {
  let x = hash32(seed) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function seededInt(seed, min, max) {
  return min + Math.floor(seededUnit(seed) * (max - min + 1));
}

export function deterministicInt(seed, min, max) {
  return seededInt(seed, min, max);
}

export function withDeterministicRandom(seed, fn) {
  const original = Math.random;
  let cursor = 0;
  Math.random = () => seededUnit(`${seed}:${cursor++}`);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function personalityFor(club) {
  return PERSONALITIES[club.circuitId] || DEFAULT_PERSONALITY;
}

function ensureEconomy(state) {
  state.economy = state.economy || {};
  if (!Number.isFinite(state.economy.leagueTreasury)) state.economy.leagueTreasury = 0;
  if (!Number.isFinite(state.economy.npcMoneyBurned)) state.economy.npcMoneyBurned = 0;
  if (!Number.isFinite(state.economy.npcMoneyMinted)) state.economy.npcMoneyMinted = 0;
  if (!Number.isFinite(state.economy.marketOutflow)) state.economy.marketOutflow = 0;
  if (!Number.isFinite(state.economy.playerRewardMinted)) state.economy.playerRewardMinted = 0;
  delete state.economy.moneyBurned;
  delete state.economy.moneyMinted;
  if (!Array.isArray(state.economy.npcTransactions)) state.economy.npcTransactions = [];
  return state.economy;
}

/** DNA tático: identidade estável do rival (formation + approach + mentalidade base). */
export function ensureNpcDna(club) {
  if (!club) return null;
  club.ai = club.ai || {};
  if (!club.ai.dna || typeof club.ai.dna !== "object") {
    club.ai.dna = {
      formation: club.formation || "4-3-3",
      approach: club.approach || "direto",
      mentality: club.mentality || "equilibrado"
    };
  }
  if (!FORMATIONS[club.ai.dna.formation]) club.ai.dna.formation = "4-3-3";
  return club.ai.dna;
}

export function ensureNpcAiState(state) {
  if (!state || typeof state !== "object") return null;
  ensureEconomy(state);
  state.npcAi = state.npcAi || {};
  if (!Array.isArray(state.npcAi.events)) state.npcAi.events = [];
  state.npcAi.arena = state.npcAi.arena || {
    day: state.day || 1,
    matches: 0,
    lastInviteDay: 0,
    pairLastAt: {}
  };
  state.npcAi.arena.pairLastAt = state.npcAi.arena.pairLastAt || {};

  (state.npcs || []).forEach((club) => {
    const personality = personalityFor(club);
    club.facilities = club.facilities || {
      training: Math.max(1, Math.ceil((club.difficulty || 1) / 3)),
      medical: Math.max(1, Math.ceil((club.difficulty || 1) / 4)),
      stadium: Math.max(1, Math.ceil((club.difficulty || 1) / 3))
    };
    club.ai = club.ai || {};
    club.ai.personality = personality.id;
    ensureNpcDna(club);
    // Restaura formation/approach do DNA (evita drift de saves antigos).
    club.formation = club.ai.dna.formation;
    club.approach = club.ai.dna.approach;
    if (!Number.isFinite(club.ai.lastProcessedDay)) club.ai.lastProcessedDay = 0;
    if (!Number.isFinite(club.ai.wageDebt)) club.ai.wageDebt = 0;
    if (!Number.isFinite(club.ai.lastMarketListDay)) club.ai.lastMarketListDay = 0;
    if (!Number.isFinite(club.ai.lastMarketBuyDay)) club.ai.lastMarketBuyDay = 0;
    if (!Array.isArray(club.ai.recentDecisions)) club.ai.recentDecisions = [];
  });
  return state.npcAi;
}

function recordDecision(state, club, type, text, amount = 0) {
  const entry = {
    id: `npc_${hash32(`${state.season}:${state.day}:${club.id}:${type}:${text}`)}`,
    season: state.season,
    day: state.day,
    clubId: club.id,
    clubName: club.name,
    type,
    text,
    amount: Math.floor(amount || 0)
  };
  club.ai.recentDecisions.unshift(entry);
  club.ai.recentDecisions.length = Math.min(club.ai.recentDecisions.length, 12);
  state.npcAi.events.unshift(entry);
  state.npcAi.events.length = Math.min(state.npcAi.events.length, 40);
  return entry;
}

function pushTransaction(state, entry) {
  const economy = ensureEconomy(state);
  economy.npcTransactions.unshift({
    id: `tx_${hash32(`${state.season}:${state.day}:${entry.clubId}:${entry.type}:${entry.playerId || ""}`)}`,
    season: state.season,
    day: state.day,
    ...entry
  });
  economy.npcTransactions.length = Math.min(economy.npcTransactions.length, 80);
}

function avgOverall(squad) {
  if (!squad?.length) return 0;
  return squad.reduce((sum, player) => sum + (player.overall || 0), 0) / squad.length;
}

function formationNeeds(club) {
  const dna = ensureNpcDna(club);
  return FORMATIONS[dna.formation] || FORMATIONS[club.formation] || FORMATIONS["4-3-3"];
}

function positionalNeed(club) {
  const needs = formationNeeds(club);
  const counts = {};
  (club.squad || []).forEach((player) => {
    if (!player.injury || player.injury.daysLeft <= 3) {
      counts[player.pos] = (counts[player.pos] || 0) + 1;
    }
  });
  const order = Object.entries(needs)
    .filter(([, required]) => required > 0)
    .map(([pos, required]) => ({ pos, gap: required + (pos === "GOL" ? 1 : 0) - (counts[pos] || 0) }))
    .sort((a, b) => b.gap - a.gap || a.pos.localeCompare(b.pos));
  return order[0]?.gap > 0 ? order[0].pos : null;
}

function playerUtility(club, player, need, personality) {
  const ageValue = player.age <= 21 ? 7 * personality.youth : player.age >= 32 ? -4 : 1;
  const fit = need && player.pos === need ? 14 : 0;
  const quality = (player.overall || 0) * 1.4 + (player.potential || player.overall || 0) * 0.25;
  const price = Math.max(1, player.marketPrice || player.value || 1);
  return quality + fit + ageValue - Math.log10(price) * 5;
}

/** Joia do elenco: top-3 ou jovem com gap de potencial (exceto trading alto). */
function isJewel(club, player, personality) {
  if (!player || !club?.squad?.length) return false;
  const ranked = [...club.squad].sort(
    (a, b) => (b.overall || 0) - (a.overall || 0) || a.id.localeCompare(b.id)
  );
  const topIds = new Set(ranked.slice(0, 3).map((p) => p.id));
  if (topIds.has(player.id) && (player.age || 25) < 28 && personality.trading < 0.78) {
    return true;
  }
  const potGap = (player.potential || 0) - (player.overall || 0);
  if ((player.age || 25) <= 21 && potGap >= 8 && personality.trading < 0.82) {
    return true;
  }
  return false;
}

/**
 * Foco do dia da comissão (determinístico).
 * recovery sempre; development: training | market_list | market_buy | rest.
 */
export function commissionDayFocus(club, state, { developmentActive = true } = {}) {
  if (!developmentActive) {
    return { focus: "maintenance", train: false, list: false, buy: false };
  }
  const need = positionalNeed(club);
  const thin = (club.squad || []).length < SQUAD_MIN;
  const urgency = thin || !!need;
  const personality = personalityFor(club);
  const roll = seededUnit(`${state.season}:${state.day}:${club.id}:focus`);

  // Urgência de elenco: prioriza compra (sem treino no mesmo dia).
  if (urgency) {
    return { focus: "market_buy", train: false, list: false, buy: true, urgency: true, need };
  }

  // ~40% treino, ~30% mercado, ~30% só manutenção
  if (roll < 0.4) {
    return { focus: "training", train: true, list: false, buy: false };
  }
  if (roll < 0.7) {
    // Mercado: listar XOR comprar (trading alto favorece compra).
    const marketRoll = seededUnit(`${state.season}:${state.day}:${club.id}:market_kind`);
    if (marketRoll < 0.45 + personality.trading * 0.25) {
      return { focus: "market_buy", train: false, list: false, buy: true };
    }
    return { focus: "market_list", train: false, list: true, buy: false };
  }
  return { focus: "rest", train: false, list: false, buy: false };
}

function marketCooldownReady(club, state, kind) {
  const last =
    kind === "list" ? club.ai.lastMarketListDay || 0 : club.ai.lastMarketBuyDay || 0;
  return state.day - last >= MARKET_COOLDOWN_DAYS || last === 0;
}

function recoverSquad(club, state) {
  const medical = club.facilities?.medical || 1;
  const boost = medical >= 3 ? 2 : medical >= 2 ? 1 : 0;
  (club.squad || []).forEach((player, index) => {
    if (player.injury) {
      player.injury.daysLeft -= 1 + boost;
      if (player.injury.daysLeft <= 0) {
        player.injury = null;
        player.stamina = Math.max(55, player.stamina || 0);
      }
    } else {
      player.stamina = clamp(
        (player.stamina || 0) + 26 + (club.difficulty || 1),
        0,
        player.maxStamina || 100
      );
    }
    const drift = seededInt(`${state.season}:${state.day}:${club.id}:morale:${index}`, -1, 2);
    player.morale = clamp((player.morale || 60) + drift, 20, 96);
    player.form = clamp((player.form || 60) + Math.sign(drift), 25, 96);
    refreshPlayerDerived(player);
  });
}

function runFinances(club, state) {
  const influence = Object.values(club.influence || {}).reduce((sum, value) => sum + Math.max(0, value), 0);
  const income = Math.floor(
    260 + (club.prestige || 10) * 28 + influence * 1.6 + (club.facilities?.stadium || 1) * 100
  );
  club.bank = Math.max(0, Number(club.bank) || 0) + income;
  ensureEconomy(state).npcMoneyMinted += income;
  pushTransaction(state, { clubId: club.id, type: "revenue", amount: income });

  if (state.day % 7 !== 0) return;
  const payroll = (club.squad || []).reduce((sum, player) => sum + Math.max(0, player.salary || 0), 0);
  const due = payroll + Math.floor(club.ai.wageDebt || 0);
  const paid = Math.min(club.bank, due);
  club.bank -= paid;
  ensureEconomy(state).npcMoneyBurned += paid;
  club.ai.wageDebt = Math.max(0, due - paid);
  pushTransaction(state, { clubId: club.id, type: "salary", amount: -paid });
  if (club.ai.wageDebt > 0) {
    (club.squad || []).forEach((player) => {
      player.morale = clamp((player.morale || 60) - 7, 15, 100);
    });
    recordDecision(state, club, "finance", `${club.name} atrasou parte da folha salarial.`);
  }
}

function trainSquad(club, state) {
  const personality = personalityFor(club);
  const dna = ensureNpcDna(club);
  const candidates = [...(club.squad || [])]
    .filter((p) => !p.injury && (p.stamina || 0) >= 45)
    .sort((a, b) => {
      const au = (a.potential || a.overall) - a.overall + (a.age <= 21 ? 6 * personality.youth : 0);
      const bu = (b.potential || b.overall) - b.overall + (b.age <= 21 ? 6 * personality.youth : 0);
      return bu - au || a.id.localeCompare(b.id);
    })
    .slice(0, 2 + Math.floor((club.facilities?.training || 1) / 2));
  const focusByStyle = {
    posse: ["pass", "pace"],
    direto: ["shoot", "physical"],
    contra_ataque: ["defend", "pace"],
    pressao: ["physical", "defend"]
  };
  const focuses = focusByStyle[dna.approach] || focusByStyle[club.approach] || ["pass", "physical"];
  candidates.forEach((player, index) => {
    const key = focuses[index % focuses.length];
    const ceiling = Math.max(player.overall || 40, player.potential || 70);
    if ((player[key] || 0) < Math.min(96, ceiling)) player[key] = clamp(player[key] + 1, 25, 96);
    player.stamina = clamp((player.stamina || 0) - 7, 0, player.maxStamina || 100);
    refreshPlayerDerived(player);
  });
  if (candidates.length) {
    recordDecision(state, club, "training", `${club.name} treinou ${candidates.length} atletas.`);
  }
}

function listSurplusPlayer(club, state) {
  if ((club.squad || []).length <= 18) return null;
  if (!marketCooldownReady(club, state, "list")) return null;
  const personality = personalityFor(club);
  const needs = formationNeeds(club);
  const counts = {};
  club.squad.forEach((p) => {
    counts[p.pos] = (counts[p.pos] || 0) + 1;
  });
  const candidate = [...club.squad]
    .filter(
      (p) =>
        counts[p.pos] > (needs[p.pos] || 0) + 1 &&
        !p.injury &&
        !isJewel(club, p, personality)
    )
    .sort((a, b) => a.overall - b.overall || b.age - a.age || a.id.localeCompare(b.id))[0];
  if (!candidate) return null;
  club.squad = club.squad.filter((p) => p.id !== candidate.id);
  candidate.clubId = null;
  candidate.onMarket = true;
  candidate.sellerClubId = club.id;
  candidate.listedDay = state.day;
  candidate.marketPrice = Math.max(500, Math.floor(calcValue(candidate) * 0.98));
  state.market.push(candidate);
  club.ai.lastMarketListDay = state.day;
  recordDecision(state, club, "market_list", `${club.name} colocou ${candidate.name} no mercado.`);
  return candidate;
}

function buyMarketPlayer(club, state, { urgency = false } = {}) {
  if ((club.squad || []).length >= SQUAD_MAX) return null;
  if ((club.ai.wageDebt || 0) > 0) return null;
  if (!urgency && !marketCooldownReady(club, state, "buy")) return null;
  const personality = personalityFor(club);
  const need = positionalNeed(club);
  const payroll = (club.squad || []).reduce((sum, player) => sum + Math.max(0, player.salary || 0), 0);
  const reserve = Math.max(2500, Math.floor(payroll * 1.25), Math.floor(club.bank * personality.reserve));
  const candidates = (state.market || [])
    .filter((p) => p.sellerClubId !== club.id)
    .map((player) => {
      const price = Math.max(500, Math.floor(player.marketPrice || player.value || 0));
      const fee = Math.floor(price * MARKET_FEE_RATE);
      return { player, price, fee, utility: playerUtility(club, player, need, personality) };
    })
    .filter((entry) => entry.price + entry.fee <= club.bank - reserve)
    .sort((a, b) => b.utility - a.utility || a.price - b.price || a.player.id.localeCompare(b.player.id));
  const target = candidates[0];
  if (!target) return null;

  const thin = (club.squad || []).length < SQUAD_MIN || !!need;
  const roll = seededUnit(`${state.season}:${state.day}:${club.id}:buy`);
  if (!urgency && !thin && roll > personality.trading * 0.4) return null;

  club.bank -= target.price + target.fee;
  ensureEconomy(state).leagueTreasury += target.fee;
  const seller = (state.npcs || []).find((npc) => npc.id === target.player.sellerClubId);
  if (seller) seller.bank += target.price;
  else ensureEconomy(state).marketOutflow += target.price;
  state.market = state.market.filter((p) => p.id !== target.player.id);
  delete target.player.sellerClubId;
  delete target.player.listedDay;
  target.player.clubId = club.id;
  target.player.onMarket = false;
  target.player.morale = clamp((target.player.morale || 60) + 4, 0, 100);
  club.squad.push(target.player);
  club.ai.lastMarketBuyDay = state.day;
  pushTransaction(state, {
    clubId: club.id,
    type: "transfer_in",
    playerId: target.player.id,
    amount: -(target.price + target.fee)
  });
  recordDecision(state, club, "market_buy", `${club.name} contratou ${target.player.name}.`, -target.price);
  return target.player;
}

function manageNpcListings(state) {
  const keep = [];
  (state.market || []).forEach((player) => {
    if (!player.sellerClubId) {
      keep.push(player);
      return;
    }
    const seller = (state.npcs || []).find((club) => club.id === player.sellerClubId);
    if (!seller) {
      delete player.sellerClubId;
      keep.push(player);
      return;
    }
    const age = Math.max(0, state.day - (player.listedDay || state.day));
    if (age >= 7 && seller.squad.length < SQUAD_MAX) {
      player.clubId = seller.id;
      player.onMarket = false;
      delete player.sellerClubId;
      delete player.listedDay;
      delete player.lastRepricedDay;
      seller.squad.push(player);
      recordDecision(state, seller, "market_return", `${player.name} voltou ao elenco de ${seller.name}.`);
      return;
    }
    if (age >= 3 && (player.lastRepricedDay || 0) < state.day - 1) {
      player.marketPrice = Math.max(500, Math.floor((player.marketPrice || player.value || 500) * 0.92));
      player.lastRepricedDay = state.day;
    }
    keep.push(player);
  });
  state.market = keep;
}

/**
 * Escalação NPC com rotação: penaliza stamina baixa e jogos recentes pesados.
 * Determinística (desempate por id).
 */
export function selectNpcXI(club, formation) {
  const form = formation || ensureNpcDna(club)?.formation || club.formation || "4-3-3";
  const need = { ...(FORMATIONS[form] || FORMATIONS["4-3-3"]) };
  const pool = (club.squad || [])
    .filter((p) => isPlayerAvailable(p))
    .map((p) => {
      const stamina = p.stamina ?? 70;
      const games = p.games || 0;
      // Poupa quem está quebrado; levemente quem joga muito (rotação).
      const staminaFactor = stamina < 40 ? 0.55 : stamina < 55 ? 0.78 : 1;
      const rotationPenalty = Math.min(8, Math.floor(games / 4));
      const score =
        (p.overall || 0) * 0.7 * staminaFactor +
        (p.form || 60) * 0.2 +
        (p.morale || 60) * 0.05 +
        stamina * 0.05 -
        rotationPenalty;
      return { ...p, score };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const xi = [];
  const used = new Set();

  Object.keys(need).forEach((pos) => {
    let n = need[pos];
    for (const p of pool) {
      if (n <= 0) break;
      if (used.has(p.id)) continue;
      if (p.pos === pos) {
        xi.push(p);
        used.add(p.id);
        n--;
      }
    }
  });

  while (xi.length < 11) {
    const next = pool.find((p) => !used.has(p.id));
    if (!next) break;
    xi.push(next);
    used.add(next.id);
  }

  return xi.slice(0, 11);
}

/**
 * DNA estável: formation e approach fixos.
 * Só mentalidade reage ao poder relativo do adversário.
 */
export function prepareNpcForOpponent(club, opponent, state) {
  if (!club?.npc || !opponent) return club;
  const personality = personalityFor(club);
  const dna = ensureNpcDna(club);
  club.formation = dna.formation;
  club.approach = dna.approach;

  const plannedXI = selectNpcXI(club, dna.formation);
  const ownPower = avgOverall(plannedXI.length ? plannedXI : club.squad);
  const oppSquad =
    opponent.id === state.club?.id
      ? state.squad
      : opponent.squad;
  const opponentPower = avgOverall(oppSquad || []);
  const ratio = ownPower / Math.max(1, opponentPower);

  let mentality = dna.mentality || "equilibrado";
  if (ratio < 0.91) {
    mentality = personality.aggression >= 0.75 ? "equilibrado" : "defesa";
  } else if (ratio > 1.12) {
    mentality = personality.aggression >= 0.5 ? "ataque" : dna.mentality || "equilibrado";
  } else if (personality.aggression >= 0.85) {
    mentality = "ataque";
  }
  club.mentality = mentality;

  club.ai.plan = {
    day: state.day,
    opponentId: opponent.id,
    formation: club.formation,
    mentality: club.mentality,
    approach: club.approach,
    dna: { ...dna }
  };
  return club;
}

/** Escolhe um comprador solvente para uma venda instantânea do jogador. */
export function chooseNpcBuyer(state, player, price) {
  ensureNpcAiState(state);
  return (state.npcs || [])
    .filter((club) => (club.squad || []).length < SQUAD_MAX)
    .map((club) => {
      const payroll = (club.squad || []).reduce((sum, candidate) => sum + Math.max(0, candidate.salary || 0), 0);
      const reserve = Math.max(1800, payroll, Math.floor(club.bank * personalityFor(club).reserve));
      const need = positionalNeed(club);
      return {
        club,
        canAfford: club.bank - reserve >= price,
        score: playerUtility(club, { ...player, marketPrice: price }, need, personalityFor(club))
      };
    })
    .filter((entry) => entry.canAfford)
    .sort((a, b) => b.score - a.score || b.club.bank - a.club.bank || a.club.id.localeCompare(b.club.id))[0]?.club || null;
}

export function creditLeagueFee(state, amount) {
  const fee = Math.max(0, Math.floor(amount || 0));
  ensureEconomy(state).leagueTreasury += fee;
  return fee;
}

export function recordNpcIncome(state, club, amount, type = "match") {
  const value = Math.max(0, Math.floor(amount || 0));
  if (!club?.npc || !value) return 0;
  club.bank = Math.max(0, Number(club.bank) || 0) + value;
  ensureEconomy(state).npcMoneyMinted += value;
  pushTransaction(state, { clubId: club.id, type, amount: value });
  return value;
}

/** Executa exatamente um ciclo para o dia atual em cada clube. */
export function processNpcDay(game) {
  const state = game?.state;
  if (!state) return [];
  ensureNpcAiState(state);
  manageNpcListings(state);
  // Comissões sempre ativas no relógio do servidor — sem depender do jogador.
  // Economia permanece limitada por reserve, cooldown de mercado e XOR treino/mercado.
  state.npcAi.managementPaused = false;
  const processed = [];
  (state.npcs || []).forEach((club) => {
    if (club.ai.lastProcessedDay >= state.day) return;
    recoverSquad(club, state);
    runFinances(club, state);
    const agenda = commissionDayFocus(club, state, { developmentActive: true });
    club.ai.dayFocus = agenda.focus;
    if (agenda.train) trainSquad(club, state);
    // XOR: list e buy não no mesmo dia (exceto urgência só buy).
    if (agenda.list) listSurplusPlayer(club, state);
    if (agenda.buy) buyMarketPlayer(club, state, { urgency: !!agenda.urgency });
    club.ai.lastProcessedDay = state.day;
    processed.push(club.id);
  });

  // Todos analisam o mesmo retrato tático (ordem do array não importa).
  const tacticalState = {
    ...state,
    club: { ...state.club },
    squad: (state.squad || []).map((player) => ({ ...player })),
    npcs: (state.npcs || []).map((club) => ({
      ...club,
      squad: (club.squad || []).map((player) => ({ ...player }))
    }))
  };
  processed.forEach((clubId) => {
    const club = state.npcs.find((entry) => entry.id === clubId);
    const fixture = (state.seasonFixtures || []).find(
      (item) => !item.played && (item.home === clubId || item.away === clubId)
    );
    const opponentId = fixture ? (fixture.home === clubId ? fixture.away : fixture.home) : null;
    const opponent =
      opponentId === state.club.id
        ? tacticalState.club
        : tacticalState.npcs.find((entry) => entry.id === opponentId);
    if (opponent) {
      prepareNpcForOpponent(club, opponent, tacticalState);
    } else {
      // Sem jogo: mantém DNA puro.
      const dna = ensureNpcDna(club);
      club.formation = dna.formation;
      club.approach = dna.approach;
      club.mentality = dna.mentality;
      club.ai.plan = {
        day: state.day,
        opponentId: null,
        formation: club.formation,
        mentality: club.mentality,
        approach: club.approach,
        dna: { ...dna }
      };
    }
    const xi = selectNpcXI(club, club.formation);
    club.ai.lastSquadPower =
      Math.round(teamStrength(xi.length ? xi : bestXI(club.squad || [], club.formation), club, null) * 10) /
      10;
  });
  return processed;
}

export function npcPublicProfile(club) {
  const personality = personalityFor(club);
  return {
    id: `bot:${club.id}`,
    clubId: club.id,
    clubName: club.name,
    displayName: `Comissão ${personality.id}`,
    rep: club.prestige || 0,
    wins: club.wins || 0,
    draws: club.draws || 0,
    losses: club.losses || 0,
    online: true,
    hasSave: true,
    bot: true,
    npc: true,
    difficulty: club.difficulty || 1
  };
}

export function npcArenaDecision(state, club, challengerState) {
  ensureNpcAiState(state);
  const apt = selectNpcXI(club, club.formation);
  if (apt.length < 11) return { accept: false, reason: "O rival está sem 11 atletas aptos." };
  const avgStamina = apt.reduce((sum, player) => sum + (player.stamina || 0), 0) / apt.length;
  if (avgStamina < 34) return { accept: false, reason: "O rival poupou o elenco por desgaste." };
  const arena = state.npcAi.arena;
  if (arena.day !== state.day) {
    arena.day = state.day;
    arena.matches = 0;
  }
  if (arena.matches >= 3) return { accept: false, reason: "O limite de jogos dos rivais neste dia foi atingido." };
  const clubPower = avgOverall(apt);
  const challengerPower = avgOverall(challengerState?.squad || []);
  const ratio = clubPower / Math.max(1, challengerPower);
  const personality = personalityFor(club);
  let chanceToAccept = 0.72 + personality.aggression * 0.18;
  if (ratio < 0.75) chanceToAccept -= 0.25;
  if (ratio > 1.35) chanceToAccept -= 0.12;
  const roll = seededUnit(`${state.season}:${state.day}:${club.id}:arena:${challengerState?.club?.id}`);
  return roll <= chanceToAccept
    ? { accept: true }
    : { accept: false, reason: "A comissão do rival recusou por estratégia esportiva." };
}

/** Resumo para UI: últimas decisões e se a gestão está pausada. */
export function npcCommissionBrief(state, limit = 8) {
  ensureNpcAiState(state);
  const events = (state.npcAi?.events || []).slice(0, limit);
  const rivals = (state.npcs || []).map((club) => {
    const dna = ensureNpcDna(club);
    const plan = club.ai?.plan;
    return {
      id: club.id,
      name: club.name,
      personality: club.ai?.personality,
      formation: plan?.formation || dna.formation,
      approach: plan?.approach || dna.approach,
      mentality: plan?.mentality || club.mentality,
      dayFocus: club.ai?.dayFocus || null,
      lastDecision: club.ai?.recentDecisions?.[0] || null
    };
  });
  return { paused: false, alwaysActive: true, events, rivals };
}
