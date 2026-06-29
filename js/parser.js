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
