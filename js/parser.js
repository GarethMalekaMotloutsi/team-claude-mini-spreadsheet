import { getCell } from "./data.js";

export function parseFormula(formula, cells) {

    // If it's not a formula, return it as normal text
    if (!formula.startsWith("=")) {
        return formula;
    }

    formula = formula.slice(1).trim();

    try {
        return evaluateFormula(formula, cells);
    } catch (error) {
        return "#ERROR";
    }
}

function evaluateFormula(expression, cells) {

    const match = expression.match(
        /^([A-Z]+\d+|\d+)\s*([+\-*/])\s*([A-Z]+\d+|\d+)$/
    );

    if (!match) {
        return "#ERROR";
    }

    let [, left, operator, right] = match;

    left = getValue(left, cells);
    right = getValue(right, cells);

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

function getValue(token, cells) {

    if (/^\d+$/.test(token)) {
        return Number(token);
    }

    if (cells[token]) {
        const value = Number(cells[token].value);

        if (isNaN(value)) {
            return 0;
        }

        return value;
    }

    return 0;
}