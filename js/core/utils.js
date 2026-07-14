/** Utilitários puros — sem dependência de estado do jogo */

export const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const chance = (p) => Math.random() * 100 < p;

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const formatMoney = (n) => Math.floor(n).toLocaleString("pt-BR");

export const riskLabel = (r) => {
  if (r === "baixo") return { text: "Risco baixo", cls: "ok" };
  if (r === "alto") return { text: "Risco alto", cls: "bad" };
  return { text: "Risco médio", cls: "warn" };
};

export const shuffleInPlace = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
