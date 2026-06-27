import { parseFormula } from "./parser.js";

const cells = {};

export function getCell(id) {
  if (!cells[id]) {
    cells[id] = { raw: '', value: '', deps: [] };
  }
  return cells[id];
}

export function commitEdit(id, raw) {
  getCell(id).raw = raw;
  getCell(id).value = parseFormula(raw, cells);
  updateDOM(id, getCell(id).value);
}

export function updateDOM(id, value) {
  const td = document.querySelector(`[data-cell="${id}"]`);
  if (!td) return;
  td.textContent = value;
}