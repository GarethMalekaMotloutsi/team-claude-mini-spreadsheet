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

const ERRORS = {
    DIV_ZERO: "#DIV/0",
    SYNTAX: "#ERROR"
};

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

    // Handle direct cell references and numeric values: A1 or 5
    const singleValueMatch = expression.match(/^([A-Z]+\d+|\d+(?:\.\d+)?)$/);
    if (singleValueMatch) {
        const value = getValue(singleValueMatch[1], cells, currentCellId);
        return typeof value === "number" ? value : value;
    }

    // Try to match simple binary operations: A1 + B1, 5 * C3, etc.
    const binaryMatch = expression.match(
        /^([A-Z]+\d+|\d+(?:\.\d+)?)\s*([+\-*/])\s*([A-Z]+\d+|\d+(?:\.\d+)?)$/
    );

    if (!binaryMatch) {
        return "#ERROR";
    }

    let [, leftToken, operator, rightToken] = binaryMatch;

    const left = getValue(leftToken, cells, currentCellId);
    const right = getValue(rightToken, cells, currentCellId);

    if (typeof left !== "number") return left;
    if (typeof right !== "number") return right;

    switch (operator) {
        case "+":
            return left + right;
        case "-":
            return left - right;
        case "*":
            return left * right;
        case "/":
            if (right === 0) {
                return ERRORS.DIV_ZERO;
            }
            return left / right;
        default:
            return ERRORS.SYNTAX;
    }
}

function evaluateValue(valueStr, cells, currentCellId) {
    if (typeof valueStr !== "string") return valueStr;
    const trimmed = valueStr.trim();

    if (trimmed.startsWith("=")) {
        return parseFormula(trimmed, cells, currentCellId);
    }

    if (/^[A-Z]+\d+$/.test(trimmed)) {
        return getValue(trimmed, cells, currentCellId);
    }

    const num = Number(trimmed);
    return isNaN(num) ? trimmed : num;
}

function getValue(token, cells, currentCellId) {
    if (typeof token !== "string") return 0;
    if (/^\d+(?:\.\d+)?$/.test(token)) {
        return Number(token);
    }

    const cellId = parseCellId(token);
    if (!cellId) {
        return 0;
    }

    const cell = cells[cellId];
    if (!cell) {
        return 0;
    }

    if (cell.raw && cell.raw.startsWith("=")) {
        if (cellId === currentCellId) {
            return "#CIRCULAR";
        }
        const result = parseFormula(cell.raw, cells, cellId);
        return result;
    }

    if (cell.value === "#CIRCULAR" || cell.value === "#ERROR" || cell.value === "#DIV/0") {
        return cell.value;
    }

    const numericValue = Number(cell.value);
    return isNaN(numericValue) ? 0 : numericValue;
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
function columnLabelToNumber(label) {
    let number = 0;
    for (const char of label) {
        number = number * 26 + (char.charCodeAt(0) - 64);
    }
    return number;
}

function numberToColumnLabel(number) {
    let label = "";
    while (number > 0) {
        const remainder = (number - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        number = Math.floor((number - 1) / 26);
    }
    return label;
}

export function parseRange(rangeStr) {
    if (typeof rangeStr !== "string") return [];

    const parts = rangeStr.split(":");
    if (parts.length !== 2) return [];

    const startMatch = parseCellId(parts[0].trim());
    const endMatch = parseCellId(parts[1].trim());

    if (!startMatch || !endMatch) return [];

    const startColLabel = startMatch.match(/^([A-Z]+)\d+$/)[1];
    const endColLabel = endMatch.match(/^([A-Z]+)\d+$/)[1];
    const startRow = parseInt(startMatch.slice(startColLabel.length), 10);
    const endRow = parseInt(endMatch.slice(endColLabel.length), 10);

    const startCol = columnLabelToNumber(startColLabel);
    const endCol = columnLabelToNumber(endColLabel);

    if (isNaN(startRow) || isNaN(endRow)) return [];

    const cells = [];
    for (let col = Math.min(startCol, endCol); col <= Math.max(startCol, endCol); col++) {
        for (let row = Math.min(startRow, endRow); row <= Math.max(startRow, endRow); row++) {
            cells.push(`${numberToColumnLabel(col)}${row}`);
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
export function extractDependencies(expression) {
    const deps = new Set();
    if (typeof expression !== "string") return [];

    const rangePattern = /([A-Z]+\d+):([A-Z]+\d+)/g;
    let rangeMatch;
    while ((rangeMatch = rangePattern.exec(expression)) !== null) {
        parseRange(rangeMatch[0]).forEach(dep => deps.add(dep));
    }

    const cellReferencePattern = /[A-Z]+\d+/g;
    const matches = expression.match(cellReferencePattern);
    if (!matches) {
        return Array.from(deps);
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
