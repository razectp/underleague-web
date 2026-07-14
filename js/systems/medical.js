import { clamp } from "../core/utils.js";
import { advanceHours } from "./time.js";

export function medicalCare(game, target) {
  const cost = target === "boss" ? 350 : 500;
  if (game.state.boss.money < cost && game.state.club.bank < cost) {
    return { ok: false, msg: "Sem fundos (pessoal ou clube)." };
  }

  const pay = () => {
    if (game.state.boss.money >= cost) game.state.boss.money -= cost;
    else game.state.club.bank -= cost;
  };

  if (target === "boss") {
    if (!game.state.boss.injury && game.state.boss.health >= 90) {
      return { ok: false, msg: "Nada a tratar." };
    }
    pay();
    if (game.state.boss.injury) {
      game.state.boss.injury.daysLeft = Math.max(0, game.state.boss.injury.daysLeft - 2);
      if (game.state.boss.injury.daysLeft === 0) game.state.boss.injury = null;
    }
    game.state.boss.health = clamp(game.state.boss.health + 25, 0, 100);
    advanceHours(game, 2, true);
    game.notify("Tratamento médico aplicado em você.", "info");
  } else {
    const p = game.state.squad.find((x) => x.id === target);
    if (!p) return { ok: false, msg: "Jogador não encontrado." };
    if (!p.injury) return { ok: false, msg: "Jogador não está lesionado." };
    pay();
    p.injury.daysLeft = Math.max(0, p.injury.daysLeft - 3);
    if (p.injury.daysLeft === 0) {
      game.notify(`${p.name} recebeu alta médica!`, "info");
      p.injury = null;
      p.stamina = 50;
    } else {
      game.notify(`${p.name}: recuperação acelerada (${p.injury.daysLeft}d restantes).`, "info");
    }
    advanceHours(game, 1, true);
  }

  game.commit();
  return { ok: true };
}
