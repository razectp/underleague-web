/**
 * Efeitos de apresentação (client-only).
 * Não altera economia, save ou autoridade do servidor.
 * Preferência reduceMotion + prefers-reduced-motion desligam motion forte.
 */

import { loadPrefs } from "../systems/prefs.js";

const FLOAT_MS = 1400;
const CONFETTI_MS = 1600;

/** @returns {boolean} */
export function wantsMotion() {
  try {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    }
  } catch {
    /* ignore */
  }
  const prefs = loadPrefs();
  if (prefs.reduceMotion) return false;
  return true;
}

/** @returns {HTMLElement} */
export function ensureFxRoot() {
  let root = document.getElementById("fx-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "fx-root";
    root.className = "fx-root";
    root.setAttribute("aria-hidden", "true");
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {Array<{ text: string, kind?: string }>} items
 * @param {{ x?: number, y?: number, anchor?: Element|null }} [opts]
 */
export function spawnFloats(items, opts = {}) {
  if (!items?.length) return;
  const root = ensureFxRoot();
  let x = opts.x;
  let y = opts.y;
  if ((x == null || y == null) && opts.anchor?.getBoundingClientRect) {
    const r = opts.anchor.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height * 0.25;
  }
  if (x == null || y == null) {
    x = window.innerWidth / 2;
    y = window.innerHeight * 0.38;
  }

  const motion = wantsMotion();
  items.forEach((item, i) => {
    if (!item?.text) return;
    const el = document.createElement("div");
    el.className = `fx-float fx-float-${item.kind || "info"}${motion ? "" : " fx-static"}`;
    el.textContent = item.text;
    const offsetX = (i - (items.length - 1) / 2) * 52;
    el.style.left = `${Math.round(x + offsetX)}px`;
    el.style.top = `${Math.round(y)}px`;
    root.appendChild(el);
    setTimeout(() => el.remove(), motion ? FLOAT_MS : 900);
  });
}

/**
 * Converte rewards do motor em floats legíveis.
 * @param {{ prize?: number, energy?: number, rep?: number, xp?: number, skillXp?: number, levelsGained?: number, stat?: string }} rewards
 * @param {{ formatMoney?: (n:number)=>string }} [opts]
 */
export function floatsFromRewards(rewards, opts = {}) {
  if (!rewards || typeof rewards !== "object") return [];
  const fmt =
    typeof opts.formatMoney === "function"
      ? opts.formatMoney
      : (n) => String(n);
  /** @type {Array<{ text: string, kind: string }>} */
  const out = [];
  if (rewards.prize > 0) out.push({ text: `+R$ ${fmt(rewards.prize)}`, kind: "money" });
  if (rewards.energy > 0) out.push({ text: `+${rewards.energy}⚡`, kind: "energy" });
  if (rewards.rep > 0) out.push({ text: `+${rewards.rep}★`, kind: "rep" });
  if (rewards.xp > 0) out.push({ text: `+${rewards.xp} XP`, kind: "xp" });
  if (rewards.skillXp > 0) {
    const label = rewards.stat ? ` ${rewards.stat}` : "";
    out.push({ text: `+${rewards.skillXp} XP${label}`, kind: "xp" });
  }
  if (rewards.levelsGained > 0) {
    out.push({
      text: `+${rewards.levelsGained} nível${rewards.levelsGained > 1 ? "s" : ""}!`,
      kind: "level"
    });
  }
  return out;
}

/**
 * Confetti leve no centro (ou âncora).
 * @param {{ count?: number, x?: number, y?: number }} [opts]
 */
export function burstConfetti(opts = {}) {
  if (!wantsMotion()) return;
  const root = ensureFxRoot();
  const count = Math.min(28, Math.max(8, opts.count || 18));
  const cx = opts.x ?? window.innerWidth / 2;
  const cy = opts.y ?? window.innerHeight * 0.35;
  const colors = ["#3ecf6a", "#e2b84a", "#5b9fd4", "#e08945", "#9b7bde", "#e05555"];

  for (let i = 0; i < count; i++) {
    const bit = document.createElement("i");
    bit.className = "fx-confetti-bit";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 40 + Math.random() * 120;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist + 40 + Math.random() * 60;
    bit.style.left = `${Math.round(cx)}px`;
    bit.style.top = `${Math.round(cy)}px`;
    bit.style.setProperty("--fx-dx", `${Math.round(dx)}px`);
    bit.style.setProperty("--fx-dy", `${Math.round(dy)}px`);
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * 0.08}s`;
    root.appendChild(bit);
    setTimeout(() => bit.remove(), CONFETTI_MS);
  }
}

/**
 * Feedback padrão após ação com rewards / fullClear / train result.
 * @param {object|null|undefined} result
 * @param {{ formatMoney?: (n:number)=>string, anchor?: Element|null }} [opts]
 */
export function presentActionFx(result, opts = {}) {
  if (!result || result.ok === false) return;

  const floats = [];
  if (result.rewards) {
    floats.push(...floatsFromRewards(result.rewards, opts));
  }
  if (result.fullClear && typeof result.fullClear === "object") {
    floats.push(...floatsFromRewards({ ...result.fullClear, xp: result.fullClear.xp || 15 }, opts));
  }
  // Treino: result.result.xpGained
  const skill = result.result;
  if (skill && (skill.xpGained > 0 || skill.levelsGained > 0)) {
    floats.push(
      ...floatsFromRewards(
        {
          skillXp: skill.xpGained,
          levelsGained: skill.levelsGained
        },
        opts
      )
    );
  }
  // Meta de temporada
  if (result.prize > 0 && !result.rewards) {
    floats.push(...floatsFromRewards({ prize: result.prize }, opts));
  }

  if (floats.length) spawnFloats(floats, { anchor: opts.anchor || null });
  if (result.fullClear) burstConfetti({ count: 22 });
}
