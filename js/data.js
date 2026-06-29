import { parseFormula } from "./parser.js";

const cells = {};

export function getCell(id) {
  if (!cells[id]) {
    cells[id] = { raw: '', value: '', deps: [] };
  }
  return cells[id];
}

export function commitEdit(id, raw) {
  // data.js owns cell storage and commit lifecycle.
  // It delegates formula evaluation to parser.js.
  const cell = getCell(id);
  cell.raw = raw;
  cell.value = parseFormula(raw, cells, id);
  updateDOM(id, cell.value);
}

export function updateDOM(id, value) {
  const td = document.querySelector(`[data-cell="${id}"]`);
  if (!td) return;
  td.textContent = value;
}
