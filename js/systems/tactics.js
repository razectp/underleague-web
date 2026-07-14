import { APPROACHES, FORMATIONS } from "../config/constants.js";
import { isPlayerAvailable } from "./availability.js";

export function setFormation(game, f) {
  if (!FORMATIONS[f]) return;
  game.state.club.formation = f;
  game.commit();
}

export function setMentality(game, m) {
  if (!["defesa", "equilibrado", "ataque"].includes(m)) return;
  game.state.club.mentality = m;
  game.commit();
}

export function setApproach(game, approach) {
  if (!APPROACHES[approach]) return;
  game.state.club.approach = approach;
  game.commit();
}

export function bestXI(squad, formation) {
  const need = { ...(FORMATIONS[formation] || FORMATIONS["4-3-3"]) };
  // Lesão, suspensão (vermelho/amarelos) e exaustão bloqueiam escalação
  const pool = squad
    .filter((p) => isPlayerAvailable(p))
    .map((p) => ({
      ...p,
      score: p.overall * 0.7 + p.form * 0.2 + p.morale * 0.05 + p.stamina * 0.05
    }))
    .sort((a, b) => b.score - a.score);

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

export function teamStrength(xi, club, bossBonus) {
  if (!xi.length) return 30;
  const avg =
    xi.reduce((a, p) => a + p.overall * 0.65 + p.form * 0.2 + p.stamina * 0.1 + p.morale * 0.05, 0) /
    xi.length;
  let mod = 1;
  if (club.mentality === "ataque") mod += 0.015;
  if (club.mentality === "defesa") mod += 0.005;
  if (bossBonus) {
    mod += bossBonus.tatica / 800;
    mod += bossBonus.lideranca / 1000;
  }
  return avg * mod;
}

/** Vantagens legíveis entre estilos, mentalidades e formações. */
export function tacticalMatchup(mine, theirs) {
  let bonus = 0;
  const reasons = [];
  const approachBeats = {
    posse: "direto",
    direto: "contra_ataque",
    contra_ataque: "pressao",
    pressao: "posse"
  };

  if (approachBeats[mine.approach] === theirs.approach) {
    bonus += 0.06;
    reasons.push("seu estilo combate o plano rival");
  } else if (approachBeats[theirs.approach] === mine.approach) {
    bonus -= 0.06;
    reasons.push("o estilo rival tem o encaixe favorável");
  }

  if (mine.mentality === "defesa" && theirs.mentality === "ataque") {
    bonus += 0.035;
    reasons.push("bloco defensivo preparado para o ataque rival");
  } else if (mine.mentality === "ataque" && theirs.mentality === "defesa") {
    bonus -= 0.025;
    reasons.push("ataque exposto ao contra-ataque");
  }

  const formationBeats = {
    "4-3-3": "3-5-2",
    "3-5-2": "4-4-2",
    "4-4-2": "4-2-3-1",
    "4-2-3-1": "4-3-3"
  };
  if (formationBeats[mine.formation] === theirs.formation) {
    bonus += 0.025;
    reasons.push("a formação ocupa melhor os espaços");
  } else if (formationBeats[theirs.formation] === mine.formation) {
    bonus -= 0.025;
    reasons.push("a formação rival cria superioridade");
  }

  return {
    bonus,
    multiplier: Math.max(0.86, Math.min(1.14, 1 + bonus)),
    reasons: reasons.length ? reasons : ["encaixe tático equilibrado"]
  };
}
