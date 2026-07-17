/**
 * Escalação manual: XI + banco (só aptos).
 */

import { FORMATIONS } from "../config/constants.js";
import { isPlayerAvailable } from "./availability.js";
import { bestXI } from "./tactics.js";

export function ensureLineup(state) {
  if (!state.lineup) {
    state.lineup = { starters: [], bench: [], auto: true };
  }
  if (!Array.isArray(state.lineup.starters)) state.lineup.starters = [];
  if (!Array.isArray(state.lineup.bench)) state.lineup.bench = [];
  // limpa IDs inválidos / indisponíveis
  const byId = new Map((state.squad || []).map((p) => [p.id, p]));
  state.lineup.starters = state.lineup.starters.filter((id) => {
    const p = byId.get(id);
    return p && isPlayerAvailable(p);
  });
  state.lineup.bench = state.lineup.bench.filter((id) => {
    const p = byId.get(id);
    return p && isPlayerAvailable(p) && !state.lineup.starters.includes(id);
  });
  return state.lineup;
}

/** Preenche XI e banco automaticamente com aptos. */
export function autoFillLineup(game) {
  const s = game.state;
  ensureLineup(s);
  const xi = bestXI(s.squad, s.club.formation);
  s.lineup.starters = xi.map((p) => p.id);
  const used = new Set(s.lineup.starters);
  s.lineup.bench = s.squad
    .filter((p) => isPlayerAvailable(p) && !used.has(p.id))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7)
    .map((p) => p.id);
  s.lineup.auto = true;
  if (typeof game.commit === "function") game.commit();
  else if (typeof game.saveSilent === "function") game.saveSilent();
  return s.lineup;
}

/**
 * Resolve o XI atual.
 * @param {{ fill?: boolean }} [opts]
 *   fill=true (padrão): se a escalação ainda está em modo auto e faltar gente,
 *   completa o XI. Nunca força re-preenchimento quando o jogador escalou à mão
 *   (lineup.auto === false) — senão "Tirar" na UI parece não funcionar.
 *   fill=false: só lê o que está salvo (usado pelo resumo da tela de escalação).
 */
export function getStartingXI(game, opts = {}) {
  const s = game.state;
  ensureLineup(s);
  const allowFill = opts.fill !== false && s.lineup.auto !== false;

  if (allowFill && s.lineup.starters.length < 11) {
    autoFillLineup(game);
  }

  const byId = new Map(s.squad.map((p) => [p.id, p]));
  const xi = s.lineup.starters.map((id) => byId.get(id)).filter(Boolean);

  // Completa com bestXI só em modo auto (lesão/suspensão tirou alguém, etc.).
  if (allowFill && xi.length < 11) {
    const auto = bestXI(s.squad, s.club.formation);
    const used = new Set(xi.map((p) => p.id));
    for (const p of auto) {
      if (xi.length >= 11) break;
      if (!used.has(p.id)) {
        xi.push(p);
        used.add(p.id);
      }
    }
    s.lineup.starters = xi.map((p) => p.id);
  }
  return xi.slice(0, 11);
}

export function getBenchPlayers(game) {
  const s = game.state;
  ensureLineup(s);
  const byId = new Map(s.squad.map((p) => [p.id, p]));
  const start = new Set(s.lineup.starters);
  return s.lineup.bench
    .map((id) => byId.get(id))
    .filter((p) => p && isPlayerAvailable(p) && !start.has(p.id));
}

export function toggleLineupPlayer(game, playerId) {
  const s = game.state;
  ensureLineup(s);
  const p = s.squad.find((x) => x.id === playerId);
  if (!p) return { ok: false, msg: "Jogador não encontrado." };
  if (!isPlayerAvailable(p)) return { ok: false, msg: "Jogador indisponível." };

  const si = s.lineup.starters.indexOf(playerId);
  const bi = s.lineup.bench.indexOf(playerId);

  if (si >= 0) {
    s.lineup.starters.splice(si, 1);
    if (s.lineup.bench.length < 7) s.lineup.bench.push(playerId);
  } else if (bi >= 0) {
    // Valide antes de remover do banco: uma tentativa recusada não pode
    // fazer o atleta desaparecer da escalação.
    if (s.lineup.starters.length >= 11) {
      return { ok: false, msg: "XI cheio (11). Tire alguém antes." };
    }
    s.lineup.bench.splice(bi, 1);
    s.lineup.starters.push(playerId);
  } else if (s.lineup.starters.length < 11) {
    s.lineup.starters.push(playerId);
  } else if (s.lineup.bench.length < 7) {
    s.lineup.bench.push(playerId);
  } else {
    return { ok: false, msg: "XI e banco cheios." };
  }

  s.lineup.auto = false;
  game.commit();
  return { ok: true };
}

export function lineupSummary(game) {
  ensureLineup(game.state);
  // Leitura pura: montar a UI não pode reescrever a escalação do jogador.
  const starters = getStartingXI(game, { fill: false });
  const bench = getBenchPlayers(game);
  const need = FORMATIONS[game.state.club.formation] || FORMATIONS["4-3-3"];
  const counts = {};
  starters.forEach((p) => {
    counts[p.pos] = (counts[p.pos] || 0) + 1;
  });
  return {
    starters,
    bench,
    formation: game.state.club.formation,
    need,
    counts,
    full: starters.length >= 11,
    avgOvr: starters.length
      ? Math.round(starters.reduce((a, p) => a + p.overall, 0) / starters.length)
      : 0
  };
}
