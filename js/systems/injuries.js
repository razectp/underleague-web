/** Lesões de dirigente e elenco */

import { INJURY_TYPES } from "../config/constants.js";
import { rand, pick, clamp } from "../core/utils.js";

export function injureBoss(game) {
  const type = pick(INJURY_TYPES.filter((x) => x.severity <= 3));
  const days = rand(type.min, type.max);
  const b = game.state.boss;
  b.injury = { id: type.id, name: type.name, daysLeft: days, severity: type.severity };
  b.health = clamp(b.health - 15 * type.severity, 10, 100);
  b.energy = Math.max(5, b.energy - 20);
  game.log(`Lesão: ${type.name} (~${days} dias).`, "bad");
}

export function injurePlayer(game, p, forceType) {
  const type = forceType || pick(INJURY_TYPES);
  let days = rand(type.min, type.max);
  // médico do clube reduz dias
  const med = game.state.club?.facilities?.medical || 1;
  days = Math.max(1, days - Math.max(0, med - 1));
  p.injury = { id: type.id, name: type.name, daysLeft: days, severity: type.severity };
  p.stamina = Math.min(p.stamina, 20);
  p.form = clamp(p.form - 10, 10, 99);
  game.log(`${p.name} — ${type.name} (${days}d).`, "bad");
  game.feed(`${p.name} é dúvida no elenco de ${game.state.club.name}.`);
}

export function healDayTick(game) {
  const s = game.state;
  const med = s.club?.facilities?.medical || 1;
  const healBoost = med >= 3 ? 2 : med >= 2 ? 1 : 0;

  if (s.boss.injury) {
    s.boss.injury.daysLeft -= 1 + (healBoost > 0 ? 0 : 0);
    if (s.boss.injury.daysLeft <= 0) {
      game.log(`Você se recuperou de: ${s.boss.injury.name}.`, "info");
      s.boss.injury = null;
      s.boss.health = clamp(s.boss.health + 20, 0, 100);
    } else {
      s.boss.health = clamp(s.boss.health + 5, 0, 85);
    }
  } else {
    s.boss.health = clamp(s.boss.health + 3, 0, 100);
  }

  s.squad.forEach((p) => {
    if (!p.injury) return;
    p.injury.daysLeft -= 1 + healBoost;
    if (p.injury.daysLeft <= 0) {
      game.log(`${p.name} voltou aos treinos (${p.injury.name}).`, "info");
      p.injury = null;
      p.stamina = 60;
      p.form = clamp(p.form - 5, 20, 99);
    }
  });
}
