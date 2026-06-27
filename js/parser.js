export function parseFormula(formula, cells) {

    if (!formula.startsWith("=")) {
        return formula;
    }

    formula = formula.slice(1);

    return formula;
}

function tokenize(expression) {

    return expression.match(/[A-Z]+\d+|\d+|[+\-*/()]/g) || [];
}