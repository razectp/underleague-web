/** Acesso ao DOM, toast e modal */

export const $ = (sel, root = document) => root.querySelector(sel);

export function toast(text, type = "info") {
  const root = $("#toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type === "bad" ? "bad" : type === "warn" ? "warn" : ""}`;
  el.setAttribute("role", type === "bad" ? "alert" : "status");
  el.setAttribute("aria-live", type === "bad" ? "assertive" : "polite");
  el.textContent = text;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

let modalReturnFocus = null;

function closeModal(root, { restoreFocus = true } = {}) {
  const app = document.getElementById("app");
  if (app) app.inert = false;
  root.classList.add("hidden");
  root.innerHTML = "";
  root.onkeydown = null;
  root.onclick = null;
  if (restoreFocus && modalReturnFocus?.isConnected) modalReturnFocus.focus();
  modalReturnFocus = null;
}

export function modal({ title, body, confirmText, onConfirm, danger }) {
  const root = $("#modal-root");
  modalReturnFocus = document.activeElement;
  const titleId = `modal-title-${Date.now()}`;
  const app = document.getElementById("app");
  if (app) app.inert = true;
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <h3 id="${titleId}">${title}</h3>
      <p>${body}</p>
      <div class="btn-row">
        <button class="btn btn-ghost" data-x>Cancelar</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${confirmText || "OK"}</button>
      </div>
    </div>`;
  const dialog = root.querySelector(".modal");
  const cancel = root.querySelector("[data-x]");
  const confirm = root.querySelector("[data-ok]");
  cancel.onclick = () => closeModal(root);
  confirm.onclick = () => {
    closeModal(root);
    if (onConfirm) onConfirm();
  };
  root.onclick = (e) => {
    if (e.target === root) closeModal(root);
  };
  root.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal(root);
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [cancel, confirm].filter((el) => !el.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  dialog.focus();
}
