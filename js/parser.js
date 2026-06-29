export function parseFormula(formula, cells, currentCellId) {
    if (typeof formula !== "string") {
        return "";
    }

    // If it's not a formula, return it as plain text.
    if (!formula.startsWith("=")) {
        if (cells[currentCellId]) {
            cells[currentCellId].deps = [];
        }
        return formula;
    }

    const expression = formula.slice(1).trim();

    const dependencies = extractDependencies(expression);
    if (cells[currentCellId]) {
        cells[currentCellId].deps = dependencies;
    }

    if (hasCycle(currentCellId, cells)) {
        return "#CIRCULAR";
    }

    try {
        return evaluateExpression(expression, currentCellId, cells);
    } catch (error) {
        return "#ERROR";
    }
}

function evaluateExpression(expression, currentCellId, cells) {
    // Try to match function calls: SUM(...), AVERAGE(...), IF(...)
    const functionMatch = expression.match(/^(SUM|AVERAGE|IF)\s*\((.*)\)$/i);
    if (functionMatch) {
        const funcName = functionMatch[1].toUpperCase();
        const args = functionMatch[2];

        switch (funcName) {
            case "SUM":
                return evaluateSUM(args, cells);
            case "AVERAGE":
                return evaluateAVERAGE(args, cells);
            case "IF":
                return evaluateIF(args, cells);
            default:
                return "#ERROR";
        }
    }

    // Try to match simple binary operations: A1 + B1, 5 * C3, etc.
    const binaryMatch = expression.match(
        /^([A-Z]+\d+|\d+)\s*([+\-*/])\s*([A-Z]+\d+|\d+)$/
    );

    if (!binaryMatch) {
        return "#ERROR";
    }

    let [, left, operator, right] = binaryMatch;

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

/**
 * Evaluates SUM(range) function.
 * Example: SUM(A1:A5) returns the sum of all numeric values in the range.
 */
function evaluateSUM(args, cells) {
    const rangeStr = args.trim();
    const rangeCells = getRangeCells(rangeStr, cells);

    if (rangeCells.length === 0) {
        return 0;
    }

    let sum = 0;
    for (const cell of rangeCells) {
        const val = Number(cell.value);
        if (!isNaN(val)) {
            sum += val;
        }
    }

    return sum;
}

/**
 * Evaluates AVERAGE(range) function.
 * Example: AVERAGE(A1:A5) returns the average of all numeric values in the range.
 */
function evaluateAVERAGE(args, cells) {
    const rangeStr = args.trim();
    const rangeCells = getRangeCells(rangeStr, cells);

    if (rangeCells.length === 0) {
        return 0;
    }

    let sum = 0;
    let count = 0;
    for (const cell of rangeCells) {
        const val = Number(cell.value);
        if (!isNaN(val)) {
            sum += val;
            count++;
        }
    }

    if (count === 0) {
        return 0;
    }

    return sum / count;
}

/**
 * Evaluates IF(condition, trueValue, falseValue) function.
 * Example: IF(A1>5, 10, 20) returns 10 if A1 > 5, otherwise 20.
 * Supports operators: >, <, >=, <=, =, !=
 */
function evaluateIF(args, cells) {
    // Split arguments by comma, but need to be careful about nested commas
    const parts = splitFunctionArgs(args);
    if (parts.length !== 3) {
        return "#ERROR";
    }

    const [conditionStr, trueValueStr, falseValueStr] = parts.map(p => p.trim());

    // Evaluate the condition
    const conditionResult = evaluateCondition(conditionStr, cells);
    if (conditionResult === "#ERROR") {
        return "#ERROR";
    }

    // Get the appropriate value based on condition result
    const resultStr = conditionResult ? trueValueStr : falseValueStr;

    // Evaluate the result value (could be a cell reference or a number)
    return evaluateValue(resultStr, cells);
}

/**
 * Splits function arguments by commas, respecting nested parentheses.
 */
function splitFunctionArgs(args) {
    const parts = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < args.length; i++) {
        const char = args[i];
        if (char === "(" || char === "[") {
            depth++;
            current += char;
        } else if (char === ")" || char === "]") {
            depth--;
            current += char;
        } else if (char === "," && depth === 0) {
            parts.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    if (current) {
        parts.push(current);
    }

    return parts;
}

/**
 * Evaluates a condition like "A1>5" or "B2=10".
 * Returns true or false; returns #ERROR for invalid conditions.
 */
function evaluateCondition(conditionStr, cells) {
    // Match patterns like: A1 > 5, B2 = 10, C3 != 0, etc.
    const conditionMatch = conditionStr.match(/^([A-Z]+\d+|\d+)\s*(>|<|>=|<=|=|!=|==)\s*([A-Z]+\d+|\d+)$/);

    if (!conditionMatch) {
        return "#ERROR";
    }

    let [, left, operator, right] = conditionMatch;

    left = getValue(left, cells);
    right = getValue(right, cells);

    switch (operator) {
        case ">":
            return left > right;
        case "<":
            return left < right;
        case ">=":
            return left >= right;
        case "<=":
            return left <= right;
        case "=":
        case "==":
            return left === right;
        case "!=":
            return left !== right;
        default:
            return "#ERROR";
    }
}

/**
 * Evaluates a value which could be a cell reference, a number, or a range.
 */
function evaluateValue(valueStr, cells) {
    valueStr = valueStr.trim();

    // Try to parse as a number
    const numVal = Number(valueStr);
    if (!isNaN(numVal)) {
        return numVal;
    }

    // Try to parse as a cell reference
    const cellId = parseCellId(valueStr);
    if (cellId && cells[cellId]) {
        const val = Number(cells[cellId].value);
        return isNaN(val) ? 0 : val;
    }

    // Default to 0 for invalid values
    return 0;
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
 * Extracts all referenced cell IDs from a formula expression.
 */
function extractDependencies(expression) {
    const deps = new Set();

    const cellReferencePattern = /[A-Z]+\d+/g;
    const matches = expression.match(cellReferencePattern);
    if (!matches) {
        return [];
    }

    for (const match of matches) {
        deps.add(match);
    }

    return Array.from(deps);
}

/**
 * DFS-based cycle detector.
 * Checks for self-references and multi-cell circular dependencies.
 */
export function hasCycle(cellId, cells, visiting = new Set(), visited = new Set()) {
    if (visiting.has(cellId)) {
        return true;
    }

    if (visited.has(cellId)) {
        return false;
    }

    const cell = cells[cellId];
    if (!cell || !cell.deps || cell.deps.length === 0) {
        visited.add(cellId);
        return false;
    }

    visiting.add(cellId);

    for (const depId of cell.deps) {
        if (depId === cellId) {
            visiting.delete(cellId);
            return true;
        }

        if (hasCycle(depId, cells, visiting, visited)) {
            visiting.delete(cellId);
            return true;
        }
    }

    visiting.delete(cellId);
    visited.add(cellId);
    return false;
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


