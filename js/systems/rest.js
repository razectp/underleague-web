import { REST_OPTIONS } from "../config/constants.js";
import { chance, clamp } from "../core/utils.js";

export function rest(game, kind) {
  const conf = REST_OPTIONS[kind];
  if (!conf) return { ok: false, msg: "Opção inválida." };
  if (game.state.boss.money < conf.cost) return { ok: false, msg: "Sem grana para isso." };
  if (game.cooldownLeft("rest") > 0) {
    return { ok: false, msg: `Aguarde ${game.cooldownLeft("rest")}h para descansar de novo.` };
  }

  game.state.boss.money -= conf.cost;
  game.state.boss.energy = clamp(game.state.boss.energy + conf.e, 0, game.state.boss.maxEnergy);
  game.state.boss.health = clamp(game.state.boss.health + conf.heal, 0, 100);
  game.state.boss.restDebt = Math.max(0, game.state.boss.restDebt - 1);

  if (game.state.boss.injury && kind !== "short" && chance(35)) {
    game.state.boss.injury.daysLeft = Math.max(0, game.state.boss.injury.daysLeft - 1);
    if (game.state.boss.injury.daysLeft === 0) {
      game.notify(`Recuperação acelerada! Livre de ${game.state.boss.injury.name}.`, "info");
      game.state.boss.injury = null;
    }
  }

  game.setCooldown("rest", conf.h);
  game.notify(`${conf.label}: +${conf.e} energia, saúde melhorou.`, "info");
  game.commit();
  return { ok: true };
}
