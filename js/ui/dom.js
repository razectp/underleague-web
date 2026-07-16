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

export function modal({ title, body, confirmText, onConfirm, onCancel, danger }) {
  const root = $("#modal-root");
  modalReturnFocus = document.activeElement;
  const titleId = `modal-title-${Date.now()}`;
  const app = document.getElementById("app");
  if (app) app.inert = true;
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <h3 id="${titleId}">${title}</h3>
      <div class="modal-body">${body}</div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-x>Cancelar</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${confirmText || "OK"}</button>
      </div>
    </div>`;
  const dialog = root.querySelector(".modal");
  const cancel = root.querySelector("[data-x]");
  const confirm = root.querySelector("[data-ok]");
  const dismiss = (cancelled) => {
    closeModal(root);
    if (cancelled && onCancel) onCancel();
  };
  cancel.onclick = () => dismiss(true);
  confirm.onclick = () => {
    // onConfirm roda com o DOM ainda aberto (ex.: ler input de confirmação)
    if (onConfirm) onConfirm();
    closeModal(root);
  };
  root.onclick = (e) => {
    if (e.target === root) dismiss(true);
  };
  root.onkeydown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss(true);
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

export function textPromptModal({ title, label, value = "", help = "", maxLength = 20, onConfirm }) {
  const root = $("#modal-root");
  modalReturnFocus = document.activeElement;
  const titleId = `modal-title-${Date.now()}`;
  const inputId = `modal-input-${Date.now()}`;
  const app = document.getElementById("app");
  if (app) app.inert = true;
  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <h3 id="${titleId}">${title}</h3>
      <label for="${inputId}"></label>
      <input id="${inputId}" class="input" type="text" maxlength="${maxLength}" autocomplete="off">
      ${help ? `<p class="micro-help">${help}</p>` : ""}
      <div class="btn-row">
        <button class="btn btn-ghost" data-x>Cancelar</button>
        <button class="btn btn-primary" data-ok>Salvar</button>
      </div>
    </div>`;
  const input = root.querySelector("input");
  root.querySelector(`label[for="${inputId}"]`).textContent = label;
  const cancel = root.querySelector("[data-x]");
  const confirm = root.querySelector("[data-ok]");
  input.value = value;
  const submit = () => {
    const nextValue = input.value.trim();
    closeModal(root);
    onConfirm?.(nextValue);
  };
  cancel.onclick = () => closeModal(root);
  confirm.onclick = submit;
  root.onclick = (event) => {
    if (event.target === root) closeModal(root);
  };
  root.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal(root);
      return;
    }
    if (event.key === "Enter" && document.activeElement === input) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [input, cancel, confirm];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  input.focus();
  input.select();
}
