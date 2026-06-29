export function parseFormula(formula, cells, currentCellId) {
    if (typeof formula !== "string") {
        return "";
    }

    // If it's not a formula, return it as plain text.
    if (!formula.startsWith("=")) {
        return formula;
    }

    const expression = formula.slice(1).trim();

    try {
        return evaluateExpression(expression, currentCellId, cells);
    } catch (error) {
        return "#ERROR";
    }
}

function evaluateExpression(expression, currentCellId, cells) {
    const match = expression.match(
        /^([A-Z]+\d+|\d+)\s*([+\-*/])\s*([A-Z]+\d+|\d+)$/
    );

    if (!match) {
        return "#ERROR";
    }

    let [, left, operator, right] = match;

    left = getValue(left, cells, currentCellId);
    right = getValue(right, cells, currentCellId);

    switch (operator) {
        case "+":
            return left + right;

        case "-":
            return left - right;

        case "*":
            return left * right;

        case "/":
            if (right === 0) return "#ERROR";
            return left / right;

        default:
            return "#ERROR";
    }
}

function getValue(token, cells, currentCellId) {
    if (/^\d+$/.test(token)) {
        return Number(token);
    }

    if (cells[token]) {
        const rawValue = cells[token].value;
        const value = Number(rawValue);

        if (isNaN(value)) {
            return 0;
        }

        return value;
    }

    return 0;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Validates a cell ID (e.g., "A1", "Z99").
 * Returns the normalized ID if valid, null otherwise.
 */
export function parseCellId(token) {
    if (typeof token !== "string") return null;
    const match = token.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return token;
}

/**
 * Converts a range string like "A1:C3" into an array of cell IDs.
 * Returns an empty array if the range is invalid.
 */
export function parseRange(rangeStr) {
    if (typeof rangeStr !== "string") return [];

    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [];

    const startCell = parseCellId(parts[0].trim());
    const endCell = parseCellId(parts[1].trim());

    if (!startCell || !endCell) return [];

    const startCol = startCell.charCodeAt(0);
    const startRow = parseInt(startCell.slice(1));
    const endCol = endCell.charCodeAt(0);
    const endRow = parseInt(endCell.slice(1));

    if (isNaN(startRow) || isNaN(endRow)) return [];

    const cells = [];
    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col++) {
        for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
            cells.push(`${String.fromCharCode(col)}${row}`);
        }
    }

    return cells;
}

/**
 * Returns an array of cell objects for all cells in a range or single reference.
 * Handles both single cells (A1) and ranges (A1:C3).
 */
export function getRangeCells(rangeStr, cells) {
    const singleCell = parseCellId(rangeStr.trim());
    let cellIds = [];

    if (singleCell) {
        cellIds = [singleCell];
    } else {
        cellIds = parseRange(rangeStr);
    }

    return cellIds.map(id => cells[id] || { raw: "", value: 0, deps: [] });
}

/**
 * Safely resolves a cell's numeric value.
 * Detects cycles and returns #CIRCULAR if found.
 * Converts non-numeric values to 0, empty cells to 0.
 */
export function getCellValue(cellId, cells, visiting = new Set(), visited = new Set()) {
    // Cycle detection: if cellId is currently being visited, we have a cycle
    if (visiting.has(cellId)) {
        return "#CIRCULAR";
    }

    // Already visited and resolved; return its value
    if (visited.has(cellId)) {
        const cell = cells[cellId];
        if (cell) {
            const val = Number(cell.value);
            return isNaN(val) ? 0 : val;
        }
        return 0;
    }

    // Mark as currently visiting
    visiting.add(cellId);

    const cell = cells[cellId];
    if (!cell) {
        visiting.delete(cellId);
        visited.add(cellId);
        return 0;
    }

    const rawValue = cell.value;
    if (rawValue === "#CIRCULAR" || rawValue === "#ERROR") {
        visiting.delete(cellId);
        visited.add(cellId);
        return rawValue;
    }

    const numValue = Number(rawValue);
    visiting.delete(cellId);
    visited.add(cellId);

    return isNaN(numValue) ? 0 : numValue;
}

/**
 * DFS-based cycle detector.
 * Checks for self-references and multi-cell circular dependencies.
 * Returns true if a cycle is found, false otherwise.
 */
export function hasCycle(cellId, cells, visiting = new Set(), visited = new Set()) {
    // Self-reference check
    const cell = cells[cellId];
    if (!cell || !cell.deps) {
        return false;
    }

    // If cellId is in its own dependencies, it's a self-reference
    if (cell.deps.includes(cellId)) {
        return true;
    }

    // Mark as currently visiting
    if (visiting.has(cellId)) {
        return true; // Cycle detected
    }

    visiting.add(cellId);

    // Check all dependencies
    for (const depId of cell.deps) {
        if (hasCycle(depId, cells, visiting, visited)) {
            return true;
        }
    }

    visiting.delete(cellId);
    visited.add(cellId);
    return false;
}
