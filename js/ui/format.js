import { clamp } from "../core/utils.js";

export function bar(val, max = 100, cls = "") {
  const pct = clamp((val / max) * 100, 0, 100);
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function statBar(label, val, max = 100, cls = "") {
  return `<div class="stat-bar"><div class="lbl"><span>${label}</span><strong>${val}</strong></div>${bar(val, max, cls)}</div>`;
}

export function timeStr(s) {
  const h = String(s.hour).padStart(2, "0");
  return `D${s.day} · ${h}h · T${s.season}`;
}
