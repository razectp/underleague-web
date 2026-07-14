/**
 * Config de runtime do cliente.
 *
 * Ordem de resolução de apiBase:
 * 1. window.__UL_CONFIG__.apiBase  (config.js na raiz)
 * 2. meta[name="ul-api-base"] content
 * 3. ""  → mesmo host (modo local: servir.bat)
 *
 * Produção (site estático + API na VPS):
 *   em config.js → apiBase: "https://api.seudominio.com"
 */

export function getRuntimeConfig() {
  const w =
    typeof window !== "undefined" && window.__UL_CONFIG__ && typeof window.__UL_CONFIG__ === "object"
      ? window.__UL_CONFIG__
      : {};

  let apiBase = typeof w.apiBase === "string" ? w.apiBase.trim() : "";

  if (!apiBase && typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="ul-api-base"]');
    if (meta?.content) apiBase = meta.content.trim();
  }

  // remove barra final
  if (apiBase.endsWith("/")) apiBase = apiBase.slice(0, -1);

  return {
    apiBase,
    /** true quando API está em outro host (deploy separado) */
    splitDeploy: Boolean(apiBase),
    /** modo local = mesmo origin, API e estáticos juntos */
    localMode: !apiBase
  };
}

export function apiUrl(path) {
  const { apiBase } = getRuntimeConfig();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase}${p}`;
}
