/**
 * Extrato financeiro do clube.
 */

import { formatMoney, uid } from "../core/utils.js";

export function ensureLedger(state) {
  if (!Array.isArray(state.ledger)) state.ledger = [];
  return state.ledger;
}

/**
 * @param {object} game
 * @param {{ type:string, amount:number, label:string, account?:'club'|'boss' }} entry
 */
export function pushLedger(game, entry) {
  if (!game?.state) return;
  ensureLedger(game.state);
  const amount = Math.floor(Number(entry.amount) || 0);
  if (!amount) return;
  game.state.ledger.unshift({
    id: uid(),
    day: game.state.day,
    hour: game.state.hour,
    season: game.state.season,
    type: entry.type || "misc",
    label: entry.label || entry.type,
    amount,
    account: entry.account || "club",
    balance:
      entry.account === "boss" ? game.state.boss.money : game.state.club.bank,
    ts: Date.now()
  });
  if (game.state.ledger.length > 80) game.state.ledger.length = 80;
}

export function ledgerSummary(game, limit = 20) {
  ensureLedger(game.state);
  const items = game.state.ledger.slice(0, limit);
  const season = game.state.ledger.filter((e) => e.season === game.state.season);
  const income = season.filter((e) => e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const expense = season.filter((e) => e.amount < 0).reduce((a, e) => a + e.amount, 0);
  return {
    items,
    seasonIncome: income,
    seasonExpense: expense,
    seasonNet: income + expense,
    clubBank: game.state.club.bank,
    bossMoney: game.state.boss.money
  };
}

export function formatLedgerLine(e) {
  const sign = e.amount > 0 ? "+" : "";
  return `D${e.day} · ${e.label} · ${sign}R$ ${formatMoney(Math.abs(e.amount))}`;
}
