import { INFLUENCE_ENERGY, INFLUENCE_MONEY, PRACAS } from "../config/constants.js";
import { clamp, formatMoney, rand } from "../core/utils.js";

export function influenceRanking(game, pracaId) {
  const praca = PRACAS.find((p) => p.id === pracaId);
  if (!praca) return null;
  const clubs = [game.state.club, ...game.state.npcs];
  const entries = clubs
    .map((club) => ({
      id: club.id,
      name: club.name,
      points: Math.round(club.influence?.[pracaId] || 0),
      you: club.id === game.state.club.id
    }))
    .filter((entry) => entry.points > 0 || entry.you);
  const total = entries.reduce((sum, entry) => sum + entry.points, 0);
  const ranking = entries
    .map((entry) => ({
      ...entry,
      score: total > 0 ? Math.round((entry.points / total) * 100) : 0
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return {
    praca,
    ranking,
    leader: ranking[0] || null,
    mine: ranking.find((entry) => entry.you) || { points: 0, score: 0, rank: ranking.length + 1, you: true }
  };
}

export function strengthenInfluence(game, pracaId) {
  const status = influenceRanking(game, pracaId);
  if (!status) return { ok: false, msg: "Região inválida." };
  if (game.cooldownLeft("influence") > 0) {
    return { ok: false, msg: `A equipe comunitária estará livre em ${game.cooldownLeft("influence")}h.` };
  }
  if (game.state.boss.energy < INFLUENCE_ENERGY) {
    return { ok: false, msg: "Energia insuficiente para organizar a ação." };
  }
  if (game.state.club.bank < INFLUENCE_MONEY) {
    return { ok: false, msg: `O clube precisa de R$ ${formatMoney(INFLUENCE_MONEY)}.` };
  }

  const club = game.state.club;
  club.influence = club.influence || {};
  const before = club.influence[pracaId] || 0;
  const beforeShare = status.mine.score;
  const leadership = game.state.boss.stats.lideranca || 10;
  let gain = rand(5, 10) + Math.floor(leadership / 22);
  if (before >= 70) gain = Math.max(2, Math.floor(gain * 0.55));
  if (before >= 90) gain = Math.max(1, Math.floor(gain * 0.4));

  game.state.boss.energy -= INFLUENCE_ENERGY;
  club.bank -= INFLUENCE_MONEY;
  club.influence[pracaId] = clamp(before + gain, 0, 100);
  game.setCooldown("influence", 6);
  game.state.boss.rep += 2;
  club.prestige += 1;
  game.addXp(8);

  const afterStatus = influenceRanking(game, pracaId);
  const becameLeader = afterStatus.leader?.you && !status.leader?.you;
  const detail = becameLeader
    ? ` ${club.name} agora tem a maior presença local, sem excluir os demais clubes.`
    : "";
  game.feed(`${club.name} realizou uma ação com torcedores e jovens em ${status.praca.name}.`);
  game.notify(
    `Influência em ${status.praca.name}: ${beforeShare}% → ${afterStatus.mine.score}% da presença local.${detail}`,
    "info"
  );
  game.commit();
  return { ok: true, gain, status: afterStatus };
}
