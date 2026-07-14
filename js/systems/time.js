/** Avanço de tempo, dia novo, efeitos passivos */

import { generatePlayer, refreshPlayerDerived } from "../data/generators.js";
import { PRACAS, REAL_MS_PER_GAME_HOUR } from "../config/constants.js";
import { rand, pick, chance, clamp, formatMoney } from "../core/utils.js";
import { healDayTick } from "./injuries.js";
import { ensureDailyMissions } from "./missions.js";

function tickCooldowns(game, h) {
  const cd = game.state.boss.cooldowns;
  Object.keys(cd).forEach((k) => {
    cd[k] -= h;
    if (cd[k] <= 0) delete cd[k];
  });
}

function paySalaries(game) {
  if (game.state.day % 7 !== 0) return;
  const total = game.state.squad.reduce((a, p) => a + (p.salary || 0), 0);
  // import dinâmico evitado — ledger opcional via push se existir no state
  const ledger = (type, amount, label) => {
    try {
      // lazy require pattern for ESM
      if (!game.state.ledger) game.state.ledger = [];
      game.state.ledger.unshift({
        id: `led_${Date.now()}_${Math.random()}`,
        day: game.state.day,
        hour: game.state.hour,
        season: game.state.season,
        type,
        label,
        amount,
        account: "club",
        balance: game.state.club.bank,
        ts: Date.now()
      });
      if (game.state.ledger.length > 80) game.state.ledger.length = 80;
    } catch {
      /* ignore */
    }
  };
  if (game.state.club.bank >= total) {
    game.state.club.bank -= total;
    ledger("salary", -total, "Folha semanal");
    game.log(`Folha semanal paga: R$ ${formatMoney(total)}.`, "info");
  } else {
    const paid = Math.floor(total * 0.5);
    game.state.club.bank = Math.max(0, game.state.club.bank - paid);
    ledger("salary", -paid, "Folha parcial");
    game.state.squad.forEach((p) => {
      p.morale = clamp(p.morale - 8, 10, 100);
    });
    game.state.boss.rep = Math.max(0, game.state.boss.rep - 3);
    game.log("Caixa apertado! Folha parcial — moral do elenco caiu.", "bad");
  }
  // contratos: a cada 30 dias de temporada, -1 ano
  if (game.state.day % 30 === 0) {
    game.state.squad.forEach((p) => {
      if (p.contractYears == null) p.contractYears = 2;
      p.contractYears = Math.max(0, p.contractYears - 1);
      if (p.contractYears === 0) {
        p.morale = clamp((p.morale || 50) - 5, 10, 100);
        game.log(`${p.name} está em final de contrato.`, "warn");
      }
    });
  }
}

function formDrift(game) {
  game.state.squad.forEach((p) => {
    if (p.injury) p.form = clamp(p.form - 2, 15, 99);
    else p.form = clamp(p.form + rand(-2, 2), 20, 99);
    p.morale = clamp(p.morale + rand(-1, 2), 15, 100);
    refreshPlayerDerived(p);
  });
}

function influenceIncome(game) {
  const influence = game.state.club.influence || {};
  const income = Object.values(influence).reduce(
    (sum, score) => sum + Math.floor(Math.max(0, score) * 2.5),
    0
  );
  if ((influence.litoral || 0) >= 30 && !game.state.boss.injury) {
    game.state.boss.health = clamp(game.state.boss.health + 2, 0, 100);
  }
  return income;
}

function weeklyInfluenceMovement(game) {
  if (game.state.day % 7 !== 0) return;
  const clubs = [game.state.club, ...game.state.npcs];
  clubs.forEach((club) => {
    club.influence = club.influence || {};
    Object.keys(club.influence).forEach((id) => {
      club.influence[id] = clamp(club.influence[id] - rand(1, 4), 0, 100);
    });
  });
  game.state.npcs.forEach((club) => {
    const region = pick(PRACAS).id;
    club.influence[region] = clamp((club.influence[region] || 0) + rand(4, 10), 0, 100);
  });
  game.feed("A semana virou: torcidas, escolinhas e clubes movimentaram sua influência regional.");
}

function refreshMarketSoft(game) {
  const m = game.state.market;
  if (m.length > 18) m.splice(0, 4);
  for (let i = 0; i < 5; i++) {
    m.push(generatePlayer({ tier: rand(1, 5), onMarket: true }));
  }
  game.feed("O mercado de transferências se mexeu.");
}

function npcMarketActivity(game) {
  if (!chance(35)) return;
  const m = game.state.market;
  if (!m.length) return;
  const idx = rand(0, m.length - 1);
  const p = m[idx];
  const club = pick(game.state.npcs);
  if (club.bank > p.marketPrice) {
    club.bank -= p.marketPrice;
    p.clubId = club.id;
    p.onMarket = false;
    club.squad.push(p);
    m.splice(idx, 1);
    game.feed(`${club.name} fechou ${p.name} no mercado.`);
  }
}

function newDay(game) {
  const s = game.state;
  s.day += 1;
  healDayTick(game);
  paySalaries(game);
  formDrift(game);
  npcMarketActivity(game);
  weeklyInfluenceMovement(game);
  const income = influenceIncome(game);
  if (income > 0) {
    s.club.bank += income;
    game.log(`Receita da presença regional: +R$ ${formatMoney(income)} no caixa do clube.`, "info");
  }
  if (s.day % 7 === 0) refreshMarketSoft(game);
  ensureDailyMissions(game);
  game.feed(`Amanhece o dia ${s.day} da temporada ${s.season}.`);
}

/**
 * @param {import('../game/Game.js').Game} game
 * @param {number} h
 * @param {boolean} [silent]
 */
export function advanceHours(game, h, silent = false) {
  const s = game.state;
  s.hour += h;
  while (s.hour >= 24) {
    s.hour -= 24;
    newDay(game);
  }
  if (s.boss.energy < s.boss.maxEnergy && !s.boss.injury) {
    s.boss.energy = clamp(s.boss.energy + Math.floor(h * 1.6), 0, s.boss.maxEnergy);
  }
  s.squad.forEach((p) => {
    if (!p.injury) p.stamina = clamp(p.stamina + h * 3.2, 0, p.maxStamina || 100);
  });
  tickCooldowns(game, h);
  if (!silent) {
    game.emit();
    game.saveSilent();
  }
}

/**
 * Concilia o estado com o relógio autoritativo. O cliente nunca informa `now`.
 * Frações menores que uma hora do jogo permanecem acumuladas no marcador.
 */
export function syncServerTime(game, now = Date.now()) {
  const s = game?.state;
  if (!s) return 0;

  let anchor = Number(s.serverClockAt);
  if (!Number.isFinite(anchor) || anchor > now) {
    s.serverClockAt = now;
    return 0;
  }

  const elapsedGameHours = Math.floor((now - anchor) / REAL_MS_PER_GAME_HOUR);
  if (elapsedGameHours <= 0) return 0;

  s.serverClockAt = anchor + elapsedGameHours * REAL_MS_PER_GAME_HOUR;
  advanceHours(game, elapsedGameHours, true);
  return elapsedGameHours;
}
