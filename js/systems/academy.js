import { SQUAD_MAX } from "../config/constants.js";
import { chance, clamp, formatMoney, rand } from "../core/utils.js";
import { generatePlayer } from "../data/generators.js";
import { advanceHours } from "./time.js";

export function academyUpgradeCost(level) {
  return [0, 2500, 6000, 12000, 22000][level] || null;
}

export function upgradeAcademy(game) {
  const club = game.state.club;
  const level = club.academyLevel || 1;
  if (level >= 5) return { ok: false, msg: "Academia já está no nível máximo." };
  const cost = academyUpgradeCost(level);
  if (club.bank < cost) return { ok: false, msg: `O clube precisa de R$ ${formatMoney(cost)}.` };
  club.bank -= cost;
  club.academyLevel = level + 1;
  club.prestige += 3;
  game.addXp(15 + level * 5);
  game.notify(`Academia evoluiu para o nível ${club.academyLevel}!`, "info");
  game.commit();
  return { ok: true };
}

export function promoteYouth(game) {
  const club = game.state.club;
  const level = club.academyLevel || 1;
  if (game.state.squad.length >= SQUAD_MAX) {
    return { ok: false, msg: `Elenco cheio (máx. ${SQUAD_MAX}).` };
  }
  if (game.cooldownLeft("academy_intake") > 0) {
    return { ok: false, msg: `Nova peneira em ${game.cooldownLeft("academy_intake")}h.` };
  }
  const cost = 250 + level * 150;
  if (club.bank < cost) return { ok: false, msg: `A peneira custa R$ ${formatMoney(cost)}.` };

  club.bank -= cost;
  const scouting = game.state.boss.stats.scouting || 10;
  const tier = clamp(1 + Math.floor(level / 2) + Math.floor(scouting / 35), 1, 5);
  const player = generatePlayer({
    age: rand(16, 19),
    tier: chance(30 + level * 7) ? Math.min(5, tier + 1) : tier,
    clubId: club.id
  });
  player.potential = clamp(player.potential + level * 3 + Math.floor(scouting / 12), 50, 99);
  player.salary = Math.max(25, Math.floor(player.salary * 0.55));
  player.academyGraduate = true;
  game.state.squad.push(player);
  advanceHours(game, 4, true);
  game.setCooldown("academy_intake", 168);
  game.state.boss.rep += 2;
  game.addXp(10);
  game.feed(`${player.name}, ${player.age} anos, sobe da base de ${club.name}.`);
  game.notify(
    `Peneira revelou ${player.name} (${player.pos}, OVR ${player.overall}, potencial ${player.potential}).`,
    "info"
  );
  game.commit();
  return { ok: true, player };
}
