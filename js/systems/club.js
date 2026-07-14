import { formatMoney } from "../core/utils.js";
import { pushLedger } from "./finance.js";

export function depositToClub(game, amount) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { ok: false, msg: "Valor inválido." };
  if (game.state.boss.money < amount) return { ok: false, msg: "Sem saldo pessoal." };
  game.state.boss.money -= amount;
  game.state.club.bank += amount;
  game.state.boss.rep += Math.floor(amount / 500);
  pushLedger(game, { type: "transfer", amount, label: "Aporte do dirigente", account: "club" });
  game.notify(`Depositou R$ ${formatMoney(amount)} no clube.`, "info");
  game.commit();
  return { ok: true };
}

export function withdrawFromClub(game, amount) {
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { ok: false, msg: "Valor inválido." };
  if (game.state.club.bank < amount) return { ok: false, msg: "Caixa do clube insuficiente." };
  if (game.state.boss.rep < 20) return { ok: false, msg: "Prestígio mínimo 20 para sacar." };
  game.state.club.bank -= amount;
  game.state.boss.money += amount;
  game.state.boss.rep = Math.max(0, game.state.boss.rep - 1);
  pushLedger(game, { type: "transfer", amount: -amount, label: "Saque do dirigente", account: "club" });
  game.notify(`Sacou R$ ${formatMoney(amount)} do clube.`, "warn");
  game.commit();
  return { ok: true };
}
