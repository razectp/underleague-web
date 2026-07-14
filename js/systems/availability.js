/**
 * Disponibilidade de jogadores — o que o técnico precisa checar antes de escalar.
 *
 * Ordem de prioridade (bloqueio):
 * 1. Lesão
 * 2. Suspensão (vermelho / acúmulo)
 * 3. Cansaço extremo (stamina)
 */

export const AVAIL_REASON = {
  ok: "ok",
  injured: "injured",
  suspended: "suspended",
  exhausted: "exhausted"
};

/**
 * @param {object} p
 * @returns {{ ok:boolean, reason:string, label:string, detail:string }}
 */
export function playerAvailability(p) {
  if (!p) {
    return { ok: false, reason: "missing", label: "Indisponível", detail: "Jogador não encontrado." };
  }
  if (p.injury) {
    return {
      ok: false,
      reason: AVAIL_REASON.injured,
      label: "Lesionado",
      detail: `${p.injury.name} · ${p.injury.daysLeft}d`
    };
  }
  if (p.suspension && p.suspension.matchesLeft > 0) {
    return {
      ok: false,
      reason: AVAIL_REASON.suspended,
      label: "Suspenso",
      detail:
        p.suspension.reason ||
        `Cumprindo suspensão (${p.suspension.matchesLeft} jogo${p.suspension.matchesLeft > 1 ? "s" : ""})`
    };
  }
  if ((p.stamina ?? 100) < 20) {
    return {
      ok: false,
      reason: AVAIL_REASON.exhausted,
      label: "Exausto",
      detail: `Stamina ${Math.floor(p.stamina)} — precisa recuperar`
    };
  }
  return { ok: true, reason: AVAIL_REASON.ok, label: "Apto", detail: "Pode jogar" };
}

export function isPlayerAvailable(p) {
  return playerAvailability(p).ok;
}

/**
 * Resumo do elenco para o técnico.
 * @param {object[]} squad
 */
export function squadAvailabilityReport(squad = []) {
  const groups = {
    available: [],
    injured: [],
    suspended: [],
    exhausted: []
  };

  squad.forEach((p) => {
    const a = playerAvailability(p);
    if (a.ok) groups.available.push({ player: p, ...a });
    else if (a.reason === AVAIL_REASON.injured) groups.injured.push({ player: p, ...a });
    else if (a.reason === AVAIL_REASON.suspended) groups.suspended.push({ player: p, ...a });
    else if (a.reason === AVAIL_REASON.exhausted) groups.exhausted.push({ player: p, ...a });
  });

  const fit = groups.available.length;
  return {
    ...groups,
    fitCount: fit,
    total: squad.length,
    canFieldXI: fit >= 11,
    shortBy: Math.max(0, 11 - fit),
    warnings: buildCoachWarnings(groups, fit, squad.length)
  };
}

function buildCoachWarnings(groups, fit, total) {
  const w = [];
  if (fit < 11) {
    w.push({
      level: "critical",
      text: `Só ${fit} aptos (faltam ${11 - fit} para o XI). Recupere elenco ou espere suspensões/lesões.`
    });
  } else if (fit < 14) {
    w.push({
      level: "warn",
      text: `Banco curto: ${fit} aptos de ${total}. Risco se houver lesão/expulsão.`
    });
  }
  if (groups.injured.length) {
    w.push({
      level: "info",
      text: `${groups.injured.length} lesionado(s) no departamento médico.`
    });
  }
  if (groups.suspended.length) {
    w.push({
      level: "warn",
      text: `${groups.suspended.length} suspenso(s) — não podem ser escalados.`
    });
  }
  if (groups.exhausted.length) {
    w.push({
      level: "info",
      text: `${groups.exhausted.length} exausto(s) — avance o tempo ou rode o elenco.`
    });
  }
  return w;
}

/** Após o clube disputar um jogo oficial: cumpre 1 jogo de suspensão quem ficou de fora. */
export function tickSuspensionsAfterMatch(squad = []) {
  const cleared = [];
  squad.forEach((p) => {
    if (!p.suspension || !(p.suspension.matchesLeft > 0)) return;
    // Quem está suspenso não joga; ao “passar” a rodada do clube, a pena cai
    p.suspension.matchesLeft -= 1;
    if (p.suspension.matchesLeft <= 0) {
      cleared.push(p.name);
      p.suspension = null;
      // limpa amarelos de ciclo se houver
      if (p.seasonYellows && p.seasonYellows >= 5) {
        /* acúmulo já gerou suspensão; zera faixa */
      }
    }
  });
  return cleared;
}

/**
 * Aplica expulsão → suspensão automática (1 jogo, regra comum de liga).
 * Amarelos na partida contam para acúmulo sazonal (5 → 1 jogo).
 */
export function applyDisciplineFromMatch(squad, { sentOffIds = [], yellowIds = [] } = {}) {
  const notes = [];
  const idSet = new Set(squad.map((p) => p.id));

  sentOffIds.forEach((id) => {
    if (!idSet.has(id)) return;
    const p = squad.find((x) => x.id === id);
    if (!p) return;
    p.suspension = {
      matchesLeft: 1,
      reason: "Expulsão (vermelho)"
    };
    notes.push(`${p.name} suspenso por 1 jogo (expulsão).`);
  });

  yellowIds.forEach((id) => {
    if (!idSet.has(id)) return;
    const p = squad.find((x) => x.id === id);
    if (!p) return;
    // só conta amarelo se não foi expulso neste jogo (2º amarelo já vira vermelho)
    if (sentOffIds.includes(id)) return;
    p.seasonYellows = (p.seasonYellows || 0) + 1;
    if (p.seasonYellows > 0 && p.seasonYellows % 5 === 0) {
      const extra = p.suspension?.matchesLeft || 0;
      p.suspension = {
        matchesLeft: Math.max(extra, 1),
        reason: `Acúmulo de amarelos (${p.seasonYellows})`
      };
      notes.push(`${p.name} suspenso por acúmulo de amarelos.`);
    }
  });

  return notes;
}
