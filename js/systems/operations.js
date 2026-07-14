import { OPERATIONS, INJURY_TYPES, PRACAS } from "../config/constants.js";
import { generatePlayer } from "../data/generators.js";
import { rand, pick, chance, clamp, formatMoney } from "../core/utils.js";
import { injureBoss, injurePlayer } from "./injuries.js";

export function runOperation(game, opId) {
  const op = OPERATIONS.find((x) => x.id === opId);
  if (!op) return { ok: false, msg: "Operação inválida." };
  if (game.cooldownLeft("op_" + opId) > 0) {
    return { ok: false, msg: `Cooldown: ${game.cooldownLeft("op_" + opId)}h.` };
  }

  const check = game.canAct(op.costE, op.costM);
  if (!check.ok) return { ok: false, msg: check.reason };

  const st = game.state.boss.stats;
  if (op.minScout && st.scouting < op.minScout) {
    return { ok: false, msg: `Scouting mínimo: ${op.minScout}.` };
  }
  if (op.minNeg && st.negocio < op.minNeg) {
    return { ok: false, msg: `Negócio mínimo: ${op.minNeg}.` };
  }
  if (op.minLead && st.lideranca < op.minLead) {
    return { ok: false, msg: `Liderança mínima: ${op.minLead}.` };
  }
  if (op.minCond && st.condicionamento < op.minCond) {
    return { ok: false, msg: `Condicionamento mínimo: ${op.minCond}.` };
  }

  game.spend(op.costE, op.costM);

  let successChance = 55;
  if (op.risk === "baixo") successChance = 72;
  if (op.risk === "alto") successChance = 38;
  successChance += Math.floor(st.scouting / 10) + Math.floor(st.negocio / 12) + Math.floor(st.lideranca / 15);
  successChance = clamp(successChance, 15, 92);

  const success = chance(successChance);
  game.setCooldown("op_" + opId, op.risk === "alto" ? 10 : 6);

  if (!success) {
    if (op.risk !== "baixo" && chance(30)) injureBoss(game);
    if (chance(40)) game.state.boss.rep = Math.max(0, game.state.boss.rep - rand(1, 4));
    if (op.id === "hostile" || op.id === "scout_rival") {
      game.feed(`Boatos envolvem ${game.state.boss.name} em jogada suja...`);
    }
    game.notify(`Operação falhou: ${op.name}.`, "bad");
    game.addXp(3);
    game.commit();
    return { ok: false, msg: "Falhou." };
  }

  let detail = "";
  switch (op.id) {
    case "scout_local": {
      const tier = clamp(2 + Math.floor(st.scouting / 25), 1, 5);
      const prospect = generatePlayer({ age: rand(16, 20), tier, onMarket: true });
      prospect.marketPrice = Math.floor(prospect.value * 0.75);
      game.state.market.unshift(prospect);
      detail = `Descobriu ${prospect.name} (${prospect.pos} OVR ${prospect.overall}) no mercado.`;
      game.state.boss.rep += 2;
      break;
    }
    case "scout_rival": {
      const npc = pick(game.state.npcs);
      const weak = [...npc.squad].sort((a, b) => a.overall - b.overall)[0];
      detail = `Relatório: ${npc.name} — fraqueza em ${weak.pos} (${weak.name}, OVR ${weak.overall}). Mentalidade: ${npc.mentality}.`;
      game.state.boss.rep += 1;
      break;
    }
    case "market_flip": {
      if (!game.state.market.length) {
        detail = "Mercado vazio — só prestígio de tentativa.";
      } else {
        const target = pick(game.state.market);
        const disc = 0.08 + st.negocio / 500;
        target.marketPrice = Math.floor(target.marketPrice * (1 - disc));
        detail = `Desconto em ${target.name}: agora R$ ${formatMoney(target.marketPrice)}.`;
      }
      break;
    }
    case "torcida": {
      const gain = rand(3, 8) + Math.floor(st.lideranca / 20);
      game.state.boss.rep += gain;
      game.state.club.prestige += Math.floor(gain / 2);
      game.state.boss.money += rand(50, 180);
      game.state.club.influence = game.state.club.influence || {};
      const active = PRACAS.filter((p) => (game.state.club.influence[p.id] || 0) > 0);
      const region = pick(active.length ? active : PRACAS);
      game.state.club.influence[region.id] = clamp(
        (game.state.club.influence[region.id] || 0) + rand(2, 5),
        0,
        100
      );
      detail = `+${gain} prestígio pessoal e presença ampliada em ${region.name}.`;
      break;
    }
    case "hostile": {
      const npc = pick(game.state.npcs);
      const stars = [...npc.squad].filter((p) => !p.injury).sort((a, b) => b.overall - a.overall);
      const star = stars[rand(0, Math.min(3, stars.length - 1))];
      if (!star) {
        detail = "Nenhum alvo viável.";
        break;
      }
      const price = Math.floor(star.value * (1.1 - st.negocio / 400));
      npc.squad = npc.squad.filter((p) => p.id !== star.id);
      star.clubId = null;
      star.onMarket = true;
      star.marketPrice = price;
      game.state.market.unshift(star);
      game.state.boss.rep += 4;
      game.feed(`${star.name} foi agitado no mercado após proposta hostil de ${game.state.club.name}!`);
      detail = `${star.name} (OVR ${star.overall}) entrou no mercado por R$ ${formatMoney(price)}.`;
      break;
    }
    case "night_racha": {
      const purse = rand(120, 400);
      game.state.boss.money += purse;
      game.state.boss.rep += 1;
      game.state.squad.forEach((p) => {
        if (!p.injury) p.morale = clamp(p.morale + 2, 0, 100);
      });
      if (chance(12)) {
        const victim = pick(game.state.squad.filter((x) => !x.injury));
        if (victim) injurePlayer(game, victim, INJURY_TYPES[0]);
      }
      detail = `Racha bem pago: +R$ ${formatMoney(purse)}. Moral do elenco sobe.`;
      break;
    }
    default:
      detail = "Sucesso.";
  }

  game.addXp(12);
  game.notify(`${op.name}: sucesso. ${detail}`, "info");
  game.commit();
  return { ok: true, msg: detail };
}
