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
    CIRCULAR: "#CIRCULAR",
    DIV_ZERO: "#DIV/0",
    VALUE: "#VALUE!",
    SYNTAX: "#ERROR"
};

function evaluateExpression(expression, currentCellId, cells) {
    // Function calls first
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
                return ERRORS.SYNTAX;
        }
    }

    // Tokenize expression for arithmetic evaluation (shunting-yard)
    const tokens = tokenizeExpression(expression);
    if (!tokens || tokens.length === 0) return ERRORS.SYNTAX;

    const rpn = toRPN(tokens);
    if (!rpn) return ERRORS.SYNTAX;

    return evaluateRPN(rpn, cells, currentCellId);
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

    // If the cell contains an explicit error marker, propagate it
    if (typeof cell.value === 'string' && cell.value.startsWith('#')) {
        return cell.value;
    }

    // If the cell has non-numeric text, this is a VALUE error when used in arithmetic
    const numericValue = Number(cell.value);
    if (isNaN(numericValue)) {
        return ERRORS.VALUE;
    }
    return numericValue;
}

// --- Tokenizer, shunting-yard, and RPN evaluator ---
function tokenizeExpression(expr) {
    const tokens = [];
    const re = /([A-Z]+\d+)|([0-9]+(?:\.[0-9]+)?)|([+\-*/()])/gi;
    let match;
    let lastIndex = 0;
    while ((match = re.exec(expr)) !== null) {
        const [token] = match;
        // capture any skipped characters (invalid)
        if (match.index > lastIndex) return null;
        lastIndex = re.lastIndex;
        tokens.push(token);
    }
    // handle unary minus: convert '-' to 'u-' when appropriate
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === '-' ) {
            const prev = out[out.length - 1];
            if (!prev || prev === '(' || ['+','-','*','/'].includes(prev)) {
                out.push('u-');
                continue;
            }
        }
        out.push(t);
    }
    return out;
}

function toRPN(tokens) {
    const output = [];
    const ops = [];
    const prec = { 'u-': 4, '*': 3, '/': 3, '+': 2, '-': 2 };
    const rightAssoc = { 'u-': true };

    for (const token of tokens) {
        if (/^[0-9]/.test(token) || /^[A-Z]+\d+$/.test(token)) {
            output.push(token);
        } else if (token === '+' || token === '-' || token === '*' || token === '/' || token === 'u-') {
            while (ops.length > 0) {
                const top = ops[ops.length -1];
                if (top === '(') break;
                const topPrec = prec[top] || 0;
                const tokPrec = prec[token] || 0;
                if ((rightAssoc[token] && tokPrec < topPrec) || (!rightAssoc[token] && tokPrec <= topPrec)) {
                    output.push(ops.pop());
                } else break;
            }
            ops.push(token);
        } else if (token === '(') {
            ops.push(token);
        } else if (token === ')') {
            let found = false;
            while (ops.length > 0) {
                const top = ops.pop();
                if (top === '(') { found = true; break; }
                output.push(top);
            }
            if (!found) return null; // mismatched parens
        } else {
            return null; // unknown token
        }
    }

    while (ops.length > 0) {
        const top = ops.pop();
        if (top === '(' || top === ')') return null;
        output.push(top);
    }

    return output;
}

function evaluateRPN(rpn, cells, currentCellId) {
    const stack = [];
    for (const token of rpn) {
        if (/^[0-9]/.test(token)) {
            stack.push(Number(token));
        } else if (/^[A-Z]+\d+$/.test(token)) {
            const val = getValue(token, cells, currentCellId);
            if (typeof val === 'string' && val.startsWith('#')) return val;
            if (typeof val !== 'number') return ERRORS.VALUE;
            stack.push(val);
        } else if (token === 'u-') {
            if (stack.length < 1) return ERRORS.SYNTAX;
            const v = stack.pop();
            if (typeof v !== 'number') return ERRORS.VALUE;
            stack.push(-v);
        } else if (['+','-','*','/'].includes(token)) {
            if (stack.length < 2) return ERRORS.SYNTAX;
            const b = stack.pop();
            const a = stack.pop();
            if (typeof a !== 'number' || typeof b !== 'number') return ERRORS.VALUE;
            switch (token) {
                case '+': stack.push(a + b); break;
                case '-': stack.push(a - b); break;
                case '*': stack.push(a * b); break;
                case '/':
                    if (b === 0) return ERRORS.DIV_ZERO;
                    stack.push(a / b);
                    break;
            }
        } else {
            return ERRORS.SYNTAX;
        }
    }
    if (stack.length !== 1) return ERRORS.SYNTAX;
    return stack[0];
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
