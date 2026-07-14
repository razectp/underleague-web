import { TRAININGS, SKILL_PROGRESS } from "../config/constants.js";
import { pick, chance, clamp } from "../core/utils.js";
import { refreshPlayerDerived } from "../data/generators.js";
import { injureBoss, injurePlayer } from "./injuries.js";
import {
  ensureBossSkillXp,
  ensurePlayerAttrXp,
  sessionXpForLevel,
  applySkillXp,
  skillBar
} from "./skillProgress.js";

export function train(game, trainId) {
  const t = TRAININGS.find((x) => x.id === trainId);
  if (!t) return { ok: false, msg: "Treino inválido." };

  const cd = game.cooldownLeft("train_" + trainId);
  if (cd > 0) return { ok: false, msg: `Treino em cooldown (${cd}h).` };
  if (game.state.boss.stats[t.stat] >= 99) return { ok: false, msg: `${t.stat} já está no máximo.` };

  const check = game.canAct(t.costE, t.costM);
  if (!check.ok) return { ok: false, msg: check.reason };

  const risk =
    2 +
    (game.state.boss.health < 50 ? 8 : 0) +
    (game.state.boss.energy < 30 ? 6 : 0) +
    (t.stat === "condicionamento" ? 5 : 0) -
    Math.floor(game.state.boss.stats.condicionamento / 12);

  game.spend(t.costE, t.costM);

  if (chance(Math.max(2, risk))) {
    injureBoss(game);
    game.notify("Treino mal executado — você se lesionou!", "bad");
    game.commit();
    return { ok: false, msg: "Lesão durante o treino." };
  }

  const skillXp = ensureBossSkillXp(game.state.boss);
  const cur = game.state.boss.stats[t.stat];
  const trainLv = game.state.club?.facilities?.training || 1;
  const xpGain = Math.floor(sessionXpForLevel(cur, "boss") * (1 + (trainLv - 1) * 0.06));
  const result = applySkillXp(cur, skillXp[t.stat], xpGain);

  game.state.boss.stats[t.stat] = result.level;
  skillXp[t.stat] = result.xp;

  game.state.boss.rep += t.rep;
  game.addXp(5 + result.levelsGained * 8 + Math.floor(xpGain / 10));
  game.setCooldown("train_" + trainId, SKILL_PROGRESS.bossTrainCooldownH);

  // Liderança: elenco só ganha XP parcial (não +1 direto)
  if (game.state.boss.stats.lideranca >= 20 && chance(SKILL_PROGRESS.leadershipSquadXpChance)) {
    const p = pick(game.state.squad.filter((x) => !x.injury));
    if (p) {
      const a = pick(["pace", "shoot", "pass", "defend", "physical"]);
      const ax = ensurePlayerAttrXp(p);
      const sub = applySkillXp(
        p[a],
        ax[a],
        randRange(SKILL_PROGRESS.leadershipSquadXp[0], SKILL_PROGRESS.leadershipSquadXp[1])
      );
      p[a] = sub.level;
      ax[a] = sub.xp;
      refreshPlayerDerived(p);
      p.stamina = clamp(p.stamina - 6, 0, p.maxStamina || 100);
    }
  }

  const bar = skillBar(result.level, result.xp);
  let msg;
  if (result.levelsGained > 0) {
    msg = `${t.name}: +${result.levelsGained} ${t.stat}! Agora ${result.level}. (+${xpGain} XP)`;
  } else {
    const almost = bar.pct >= 70 ? " Quase sobe!" : "";
    msg = `${t.name}: +${xpGain} XP em ${t.stat} (${bar.cur}/${bar.need}).${almost}`;
  }

  game.notify(msg, "info");
  game.commit();
  return { ok: true, msg, result, bar };
}

function randRange(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

export function trainSquadFocus(game, playerId, attr) {
  const p = game.state.squad.find((x) => x.id === playerId);
  if (!p) return { ok: false, msg: "Jogador não encontrado." };
  if (p.injury) return { ok: false, msg: "Jogador lesionado." };
  if (p.stamina < 25) return { ok: false, msg: "Jogador exausto." };
  const attrs = ["pace", "shoot", "pass", "defend", "physical"];
  if (!attrs.includes(attr)) return { ok: false, msg: "Atributo inválido." };
  if (p[attr] >= 99) return { ok: false, msg: `${attr} já está no máximo.` };

  const costE = 10;
  const costM = 40;
  const check = game.canAct(costE, costM);
  if (!check.ok) return { ok: false, msg: check.reason };
  if (game.cooldownLeft("squad_train") > 0) {
    return { ok: false, msg: `Aguarde ${game.cooldownLeft("squad_train")}h.` };
  }

  game.spend(costE, costM);

  if (chance(4 + ((p.maxStamina || 100) - p.stamina) / 12)) {
    injurePlayer(game, p);
    game.notify(`${p.name} se lesionou no treino individual!`, "bad");
    game.commit();
    return { ok: false, msg: "Lesão no elenco." };
  }

  const ax = ensurePlayerAttrXp(p);
  const atPotential = p.overall >= (p.potential || 99);
  const xpGain = Math.max(
    3,
    Math.floor(sessionXpForLevel(p[attr], "squad") * (atPotential ? 0.35 : 1))
  );
  const result = applySkillXp(p[attr], ax[attr], xpGain);
  p[attr] = result.level;
  ax[attr] = result.xp;
  refreshPlayerDerived(p);
  p.stamina = clamp(p.stamina - 18, 0, p.maxStamina || 100);
  p.form = clamp(p.form + (result.levelsGained ? 2 : 1), 1, 99);

  game.setCooldown("squad_train", SKILL_PROGRESS.squadTrainCooldownH);
  game.addXp(4 + result.levelsGained * 5);

  const bar = skillBar(result.level, result.xp);
  const msg =
    result.levelsGained > 0
      ? `${p.name}: +${result.levelsGained} ${attr} → ${result.level} (OVR ${p.overall})`
      : `${p.name}: +${xpGain} XP em ${attr} (${bar.cur}/${bar.need})${atPotential ? " · perto do limite de potencial" : ""}`;

  game.notify(msg, "info");
  game.commit();
  return { ok: true, msg, result };
}

export { skillBar, ensureBossSkillXp };
