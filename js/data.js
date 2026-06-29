import { parseFormula, extractDependencies } from "./parser.js";

const cells = {};

export function getCell(id) {
  if (!cells[id]) {
    cells[id] = { raw: '', value: '', deps: [] };
  }
  return cells[id];
}

export function commitEdit(id, raw) {
  const cell = getCell(id);
  cell.raw = raw;
  refreshAllCells();
}

function refreshAllCells() {
  const ids = Object.keys(cells);

  // First pass: compute dependencies for every cell.
  for (const id of ids) {
    const cell = cells[id];
    if (typeof cell.raw === 'string' && cell.raw.startsWith('=')) {
      cell.deps = extractDependencies(cell.raw.slice(1).trim());
    } else {
      cell.deps = [];
    }
  }

  // Second pass: evaluate all cells until values stabilize.
  let changed = true;
  let pass = 0;
  const maxPasses = ids.length * 2;

  while (changed && pass < maxPasses) {
    changed = false;
    pass += 1;

    for (const id of ids) {
      const cell = cells[id];
      const newValue = parseFormula(cell.raw, cells, id);
      if (cell.value !== newValue) {
        cell.value = newValue;
        changed = true;
      }
    }
  }

  // Update DOM for all cells.
  for (const id of ids) {
    updateDOM(id, cells[id].value);
  }
}

export function updateDOM(id, value) {
  if (typeof document === 'undefined') return;
  const td = document.querySelector(`[data-cell="${id}"]`);
  if (!td) return;
  td.textContent = value;
}
