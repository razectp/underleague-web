import { playerDisplayName } from "../data/generators.js";

export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[char]);

export const playerNameHtml = (player) => escapeHtml(playerDisplayName(player));
