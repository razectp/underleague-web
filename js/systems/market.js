import { MARKET_FEE_RATE, SQUAD_MIN, SQUAD_MAX } from "../config/constants.js";
import { calcValue } from "../data/generators.js";
import { clamp, formatMoney } from "../core/utils.js";
import { pushLedger } from "./finance.js";
import { chooseNpcBuyer, creditLeagueFee, ensureNpcAiState } from "./npcAi.js";

export function buyPlayer(game, playerId) {
  const idx = game.state.market.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, msg: "Jogador indisponível." };

  const p = game.state.market[idx];
  const price = p.marketPrice;
  const fee = Math.floor(price * MARKET_FEE_RATE);
  const total = price + fee;

  const useClub = game.state.club.bank >= total;
  if (!useClub && game.state.boss.money < total) {
    return { ok: false, msg: `Precisa de R$ ${formatMoney(total)} (preço + 3% taxa).` };
  }
  if (game.state.squad.length >= SQUAD_MAX) {
    return { ok: false, msg: `Elenco cheio (máx ${SQUAD_MAX}).` };
  }

  if (useClub) game.state.club.bank -= total;
  else game.state.boss.money -= total;
  ensureNpcAiState(game.state);
  const seller = game.state.npcs.find((club) => club.id === p.sellerClubId);
  if (seller) seller.bank += price;
  else game.state.economy.marketOutflow += price;
  creditLeagueFee(game.state, fee);
  pushLedger(game, {
    type: "transfer_in",
    amount: -total,
    label: `Contratação ${p.name}`,
    account: useClub ? "club" : "boss"
  });

  p.onMarket = false;
  p.clubId = game.state.club.id;
  delete p.sellerClubId;
  delete p.listedDay;
  delete p.lastRepricedDay;
  p.morale = clamp(p.morale + 5, 0, 100);
  if (p.contractYears == null) p.contractYears = 2;
  game.state.squad.push(p);
  game.state.market.splice(idx, 1);
  // limpa escalação auto se estava cheia
  if (game.state.lineup) game.state.lineup.auto = false;

  game.state.boss.rep += 1;
  game.addXp(6);
  game.notify(`Contratou ${p.name} por R$ ${formatMoney(price)} (+taxa R$ ${formatMoney(fee)}).`, "info");
  game.feed(`${game.state.club.name} anuncia ${p.name}.`);
  game.commit();
  return { ok: true };
}

export function sellPlayer(game, playerId) {
  const idx = game.state.squad.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, msg: "Não está no elenco." };
  if (game.state.squad.length <= SQUAD_MIN) {
    return { ok: false, msg: `Mínimo de ${SQUAD_MIN} jogadores no elenco.` };
  }

  const p = game.state.squad[idx];
  const price = Math.floor(calcValue(p) * (0.85 + game.state.boss.stats.negocio / 500));
  const fee = Math.floor(price * MARKET_FEE_RATE);
  const net = price - fee;
  const buyer = chooseNpcBuyer(game.state, p, price);
  if (!buyer) {
    return { ok: false, msg: "Nenhum clube apresentou uma proposta compatível agora." };
  }

  game.state.squad.splice(idx, 1);
  buyer.bank -= price;
  game.state.club.bank += net;
  creditLeagueFee(game.state, fee);
  pushLedger(game, { type: "transfer_out", amount: net, label: `Venda ${p.name}` });
  if (game.state.lineup) {
    game.state.lineup.starters = (game.state.lineup.starters || []).filter((id) => id !== playerId);
    game.state.lineup.bench = (game.state.lineup.bench || []).filter((id) => id !== playerId);
  }

  p.clubId = buyer.id;
  p.onMarket = false;
  buyer.squad.push(p);
  game.feed(`${p.name} acertou com ${buyer.name}.`);

  game.addXp(4);
  game.notify(`Vendeu ${p.name} · líquido R$ ${formatMoney(net)} (taxa 3%).`, "info");
  game.commit();
  return { ok: true };
}
