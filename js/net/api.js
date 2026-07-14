/**
 * Cliente HTTP — API na mesma origem (local) ou em VPS (apiBase).
 *
 * Persistência de campanha: somente no servidor/banco via /api/game/*.
 * No navegador só o token de sessão (e prefs de UI em prefs.js).
 */

import { apiUrl, getRuntimeConfig } from "../config/runtime.js";

const TOKEN_KEY = "underleague_token";

/** Chaves de localStorage permitidas no cliente (nunca estado de jogo). */
export const BROWSER_STORAGE_KEYS = Object.freeze([
  TOKEN_KEY,
  "underleague_prefs_v1",
  "ul_nav_more"
]);

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getApiBase() {
  return getRuntimeConfig().apiBase;
}

const DEFAULT_TIMEOUT_MS = 12_000;

export async function request(
  path,
  { method = "GET", body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs));
  try {
    const res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    let data;
    try {
      data = await res.json();
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      data = { ok: false, error: "Não foi possível concluir a solicitação. Tente novamente." };
    }
    if (!data || typeof data !== "object") {
      data = { ok: false, error: "Não foi possível concluir a solicitação. Tente novamente." };
    }
    if (auth && res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("underleague:unauthorized"));
    }
    if (!res.ok && !data.error) data.error = `HTTP ${res.status}`;
    return data;
  } catch (error) {
    return {
      ok: false,
      error:
        error?.name === "AbortError"
          ? "A conexão demorou demais. Tente novamente."
          : "O jogo está temporariamente indisponível. Tente novamente em instantes."
    };
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => request("/api/health", { auth: false }),
  register: (payload) =>
    request("/api/auth/register", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload, auth: false }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/me"),
  identitySuggestion: () => request("/api/identity/suggestion"),

  gameState: () => request("/api/game/state"),

  gameAction: (action, payload = {}) =>
    request("/api/game/action", {
      method: "POST",
      body: { action, payload }
    }),

  players: () => request("/api/players"),
  challenge: (toUserId) =>
    request("/api/arena/challenge", { method: "POST", body: { toUserId } }),
  challenges: () => request("/api/arena/challenges"),
  respond: (challengeId, accept) =>
    request("/api/arena/respond", { method: "POST", body: { challengeId, accept } }),
  cancelChallenge: (challengeId) =>
    request("/api/arena/cancel", { method: "POST", body: { challengeId } }),
  feed: () => request("/api/arena/feed", { auth: false }),
  rankings: () => request("/api/rankings", { auth: false }),
  lobby: () => request("/api/lobby", { auth: false })
};

/**
 * @returns {Promise<{ ok: boolean, health?: object, error?: string }>}
 */
export async function probeServer() {
  try {
    const r = await api.health();
    if (r?.ok) return { ok: true, health: r };
    return {
      ok: false,
      error: r?.error || "O jogo está temporariamente indisponível. Tente novamente em instantes."
    };
  } catch {
    return {
      ok: false,
      error: "O jogo está temporariamente indisponível. Tente novamente em instantes."
    };
  }
}

export async function isServerUp() {
  const probe = await probeServer();
  return probe.ok;
}
