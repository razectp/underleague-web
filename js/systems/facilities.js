/**
 * Estrutura do clube: CT, médico, estádio.
 */

import { formatMoney } from "../core/utils.js";
import { pushLedger } from "./finance.js";

export const FACILITY_DEFS = {
  training: {
    label: "Centro de treino",
    max: 5,
    costs: [0, 2500, 5000, 9000, 15000],
    blurb: "Melhora o rendimento de treinos do elenco."
  },
  medical: {
    label: "Departamento médico",
    max: 5,
    costs: [0, 2000, 4500, 8000, 13000],
    blurb: "Recuperação de lesões mais rápida."
  },
  stadium: {
    label: "Estádio / campo",
    max: 5,
    costs: [0, 4000, 8000, 14000, 22000],
    blurb: "Mais receita de bilheteria por jogo em casa."
  }
};

export function ensureFacilities(club) {
  club.facilities = club.facilities || { training: 1, medical: 1, stadium: 1 };
  for (const k of Object.keys(FACILITY_DEFS)) {
    club.facilities[k] = Math.max(1, Math.min(5, club.facilities[k] || 1));
  }
  return club.facilities;
}

export function facilityUpgradeCost(club, key) {
  ensureFacilities(club);
  const def = FACILITY_DEFS[key];
  if (!def) return null;
  const level = club.facilities[key] || 1;
  if (level >= def.max) return null;
  return def.costs[level] || null;
}

export function upgradeFacility(game, key) {
  const club = game.state.club;
  ensureFacilities(club);
  const cost = facilityUpgradeCost(club, key);
  if (cost == null) return { ok: false, msg: "Nível máximo ou inválido." };
  if (club.bank < cost) return { ok: false, msg: "Caixa insuficiente." };
  club.bank -= cost;
  club.facilities[key] += 1;
  pushLedger(game, {
    type: "facility",
    amount: -cost,
    label: `Upgrade ${FACILITY_DEFS[key].label} Nv.${club.facilities[key]}`
  });
  game.notify(
    `${FACILITY_DEFS[key].label} → nível ${club.facilities[key]} · -R$ ${formatMoney(cost)}`,
    "info"
  );
  game.commit();
  return { ok: true };
}

/** Bônus de bilheteria em jogos em casa */
export function homeGateBonus(club) {
  ensureFacilities(club);
  return 150 + (club.facilities.stadium || 1) * 120;
}

/** Reduz dias de lesão ao aplicar (médico) */
export function medicalDaysDiscount(club) {
  ensureFacilities(club);
  return Math.max(0, (club.facilities.medical || 1) - 1);
}

export function trainingXpBonus(club) {
  ensureFacilities(club);
  return 1 + ((club.facilities.training || 1) - 1) * 0.06;
}
