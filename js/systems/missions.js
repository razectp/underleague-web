/**
 * Tarefas do dia — checklist fixo (não aleatório).
 * Cada uma dá recompensa pequena e útil: grana no bolso + um pouco de ⚡.
 */

import { clamp, formatMoney } from "../core/utils.js";

/**
 * Conjunto fixo de todo dia.
 * Ordem = rotina natural: treinar → elenco → descanso → circuito → liga.
 */
export const DAILY_MISSIONS = [
  {
    id: "daily_train",
    type: "train",
    target: 1,
    prize: 90,
    energy: 10,
    rep: 1,
    label: "Treino pessoal",
    blurb: "Complete 1 treino do técnico."
  },
  {
    id: "daily_squad",
    type: "squad_train",
    target: 1,
    prize: 80,
    energy: 8,
    rep: 0,
    label: "Treino do elenco",
    blurb: "Treine 1 atributo de um jogador."
  },
  {
    id: "daily_rest",
    type: "rest",
    target: 1,
    prize: 60,
    energy: 14,
    rep: 0,
    label: "Descanso",
    blurb: "Descanse ao menos uma vez."
  },
  {
    id: "daily_circuit",
    type: "circuit",
    target: 1,
    prize: 110,
    energy: 8,
    rep: 1,
    label: "Circuito de treino",
    blurb: "Dispute 1 partida no circuito."
  },
  {
    id: "daily_match",
    type: "match",
    target: 1,
    prize: 130,
    energy: 10,
    rep: 2,
    label: "Rodada da liga",
    blurb: "Dispute 1 partida oficial."
  },
  {
    id: "daily_ops",
    type: "operation",
    target: 1,
    prize: 100,
    energy: 8,
    rep: 1,
    label: "Operação de bastidor",
    blurb: "Execute 1 operação (scouting, torcida…)."
  }
];

/** Bônus ao resgatar todas as tarefas do dia */
export const DAILY_FULL_CLEAR = {
  prize: 200,
  energy: 20,
  rep: 3,
  label: "Dia completo"
};

function buildFixedMissions() {
  return DAILY_MISSIONS.map((def) => ({
    id: def.id,
    type: def.type,
    target: def.target,
    progress: 0,
    prize: def.prize,
    energy: def.energy,
    rep: def.rep,
    label: def.label,
    blurb: def.blurb,
    claimed: false
  }));
}

/** @deprecated alias para testes/legado */
export const MISSION_CATALOG = DAILY_MISSIONS;

/** Garante missões do dia atual (fixas, sempre as mesmas) */
export function ensureDailyMissions(game) {
  if (!game.state) return;

  const day = game.state.day;
  const cur = game.state.missions;

  // Save antigo / dia novo / lista incompleta → checklist fixo
  const needsReset =
    !cur ||
    cur.day !== day ||
    !cur.fixed ||
    !Array.isArray(cur.items) ||
    cur.items.length !== DAILY_MISSIONS.length ||
    cur.items.some((m, i) => m.id !== DAILY_MISSIONS[i].id);

  if (!needsReset) return;

  const wasNewDay = cur && cur.day !== day;
  game.state.missions = {
    day,
    fixed: true,
    fullClaimed: false,
    items: buildFixedMissions()
  };

  if (wasNewDay && typeof game.feed === "function") {
    game.feed("Tarefas do dia renovadas — checklist completo disponível.");
  }
}

/** Incrementa progresso de missões do tipo */
export function trackMission(game, type, amount = 1) {
  ensureDailyMissions(game);
  const items = game.state.missions?.items || [];
  let changed = false;
  items.forEach((m) => {
    if (m.claimed || m.type !== type) return;
    if (m.progress >= m.target) return;
    m.progress = Math.min(m.target, m.progress + amount);
    changed = true;
  });
  if (changed && typeof game.saveSilent === "function") {
    game.saveSilent();
  }
}

function grantRewards(game, { prize = 0, energy = 0, rep = 0 }) {
  const b = game.state.boss;
  if (prize) b.money += prize;
  if (rep) b.rep += rep;
  if (energy) {
    b.energy = clamp(b.energy + energy, 0, b.maxEnergy);
  }
}

/** Resgata recompensa de missão completa */
export function claimMission(game, missionId) {
  ensureDailyMissions(game);
  const m = game.state.missions.items.find((x) => x.id === missionId);
  if (!m) return { ok: false, msg: "Tarefa não encontrada." };
  if (m.claimed) return { ok: false, msg: "Já resgatada." };
  if (m.progress < m.target) return { ok: false, msg: "Tarefa incompleta." };

  m.claimed = true;
  grantRewards(game, { prize: m.prize, energy: m.energy || 0, rep: m.rep || 0 });
  game.addXp(8 + (m.rep || 0) * 2);

  const parts = [`+R$ ${formatMoney(m.prize)}`];
  if (m.energy) parts.push(`+${m.energy}⚡`);
  if (m.rep) parts.push(`+${m.rep}★`);

  game.notify(`Tarefa: ${m.label} · ${parts.join(" · ")}`, "info");

  // Bônus se todas foram resgatadas
  const allClaimed = game.state.missions.items.every((x) => x.claimed);
  if (allClaimed && !game.state.missions.fullClaimed) {
    game.state.missions.fullClaimed = true;
    const bonus = DAILY_FULL_CLEAR;
    grantRewards(game, bonus);
    game.addXp(15);
    game.notify(
      `${bonus.label}! · +R$ ${formatMoney(bonus.prize)} · +${bonus.energy}⚡ · +${bonus.rep}★`,
      "info"
    );
    if (typeof game.feed === "function") {
      game.feed(`${game.state.club.name} fechou o checklist do dia.`);
    }
  }

  game.commit();
  return { ok: true };
}

export function missionsSummary(game) {
  ensureDailyMissions(game);
  const items = game.state.missions.items;
  const done = items.filter((m) => m.progress >= m.target).length;
  const claimed = items.filter((m) => m.claimed).length;
  return {
    items,
    done,
    claimed,
    total: items.length,
    fullClaimed: !!game.state.missions.fullClaimed,
    fullClear: DAILY_FULL_CLEAR
  };
}
