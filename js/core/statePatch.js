/** Sincronização incremental do estado autoritativo (compatível com browser e Node). */

export const STATE_PATCH_MODE = "top-level-v1";

export function stateRevision(revision) {
  const value = Number(revision);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function jsonEqual(left, right) {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Gera um patch apenas das chaves de topo alteradas.
 * Arrays/objetos alterados continuam sendo substituídos por inteiro, evitando
 * merges ambíguos em escalações, calendário e históricos.
 */
export function buildTopLevelStatePatch(before, after, baseRevision = 0, revision = 0) {
  const set = {};
  const remove = [];
  const previous = before && typeof before === "object" ? before : {};
  const next = after && typeof after === "object" ? after : {};

  for (const [key, value] of Object.entries(next)) {
    if (!Object.hasOwn(previous, key) || !jsonEqual(previous[key], value)) {
      set[key] = value;
    }
  }
  for (const key of Object.keys(previous)) {
    if (!Object.hasOwn(next, key)) remove.push(key);
  }

  return {
    mode: STATE_PATCH_MODE,
    baseRevision: stateRevision(baseRevision),
    revision: stateRevision(revision),
    set,
    remove
  };
}

/** Retorna null quando o patch não pertence à revisão local atual. */
export function applyTopLevelStatePatch(state, patch, currentRevision = 0) {
  if (!state || !patch || patch.mode !== STATE_PATCH_MODE) return null;
  if (!Number.isSafeInteger(currentRevision) || currentRevision < 0) return null;
  if (!Number.isSafeInteger(patch.baseRevision) || patch.baseRevision < 0) return null;
  if (!Number.isSafeInteger(patch.revision) || patch.revision <= patch.baseRevision) return null;
  if (currentRevision !== Number(patch.baseRevision)) return null;
  if (!patch.set || typeof patch.set !== "object" || Array.isArray(patch.set)) return null;
  if (!Array.isArray(patch.remove)) return null;

  const next = { ...state, ...patch.set };
  for (const key of patch.remove) {
    if (typeof key === "string") delete next[key];
  }
  return next;
}
