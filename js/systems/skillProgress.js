/**
 * Progressão lenta de atributos (boss + elenco).
 * Treino preenche barra de XP; +1 só ao completar.
 */

import { SKILL_PROGRESS, xpNeededForLevel } from "../config/constants.js";
import { rand, clamp } from "../core/utils.js";

export function emptyBossSkillXp() {
  return {
    tatica: 0,
    scouting: 0,
    negocio: 0,
    lideranca: 0,
    condicionamento: 0
  };
}

export function emptyAttrXp() {
  return { pace: 0, shoot: 0, pass: 0, defend: 0, physical: 0 };
}

/** XP de uma sessão: boost no early, retornos decrescentes no mid/end */
export function sessionXpForLevel(level, kind = "boss") {
  const cfg = SKILL_PROGRESS;
  let xp =
    kind === "squad"
      ? rand(cfg.squadXpMin, cfg.squadXpMax)
      : rand(cfg.sessionXpMin, cfg.sessionXpMax);

  // Early game: feedback rápido (1–3 treinos = +1)
  if (level < 15) xp = Math.floor(xp * 1.45);
  else if (level < 25) xp = Math.floor(xp * 1.2);

  if (level >= 35) xp = Math.floor(xp * 0.85);
  if (level >= 50) xp = Math.floor(xp * 0.72);
  if (level >= 65) xp = Math.floor(xp * 0.58);
  if (level >= 80) xp = Math.floor(xp * 0.42);
  if (level >= 90) xp = Math.floor(xp * 0.3);

  return Math.max(kind === "squad" ? 8 : 10, xp);
}

/**
 * Aplica XP a um valor de skill + contador de xp.
 * @returns {{ level, xp, levelsGained, need, xpGained }}
 */
export function applySkillXp(level, xp, xpGained) {
  let L = level;
  let X = (xp || 0) + xpGained;
  let levelsGained = 0;
  let guard = 0;

  while (L < 99 && guard < 20) {
    guard++;
    const need = xpNeededForLevel(L);
    if (X < need) break;
    X -= need;
    L += 1;
    levelsGained += 1;
  }

  if (L >= 99) {
    L = 99;
    X = 0;
  }

  return {
    level: L,
    xp: X,
    levelsGained,
    need: xpNeededForLevel(L),
    xpGained
  };
}

export function skillBar(level, xp) {
  const need = xpNeededForLevel(level);
  const cur = xp || 0;
  return {
    need,
    cur,
    pct: need > 0 ? clamp((cur / need) * 100, 0, 100) : 0
  };
}

export function ensureBossSkillXp(boss) {
  if (!boss.skillXp) boss.skillXp = emptyBossSkillXp();
  for (const k of Object.keys(emptyBossSkillXp())) {
    if (typeof boss.skillXp[k] !== "number") boss.skillXp[k] = 0;
  }
  return boss.skillXp;
}

export function ensurePlayerAttrXp(player) {
  if (!player.attrXp) player.attrXp = emptyAttrXp();
  for (const k of Object.keys(emptyAttrXp())) {
    if (typeof player.attrXp[k] !== "number") player.attrXp[k] = 0;
  }
  return player.attrXp;
}
