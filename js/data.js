const cells = {};

export function getCell(id) {
  if (!cells[id]) {
    cells[id] = { raw: '', value: '', deps: [] };
  }
  return cells[id];
}

export function commitEdit(id, raw) {
  getCell(id).raw = raw;
  getCell(id).value = raw;//@Lerato you will replace this line
  updateDOM(id, getCell(id).value);
}

export function updateDOM(id, value) {
  const td = document.querySelector(`[data-cell="${id}"]`);
  if (!td) return;
  td.textContent = value;
}