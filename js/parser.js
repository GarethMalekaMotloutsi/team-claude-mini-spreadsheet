import { getCell } from "./data.js";

const ERRORS = {
    SYNTAX: "#ERROR!",
    DIV_ZERO: "#DIV/0!",
    VALUE: "#VALUE!"
};

export function parseFormula(formula, cells) {

    if (formula === undefined || formula === null) {

        console.log("PARSED RESULT:", result);
        
        return "";
    }

    formula = String(formula).trim();

    if (!formula.startsWith("=")) {

        if (formula === "") {
            return "";
        }

        const number = Number(formula);

        if (!isNaN(number)) {
            return number;
        }

        return formula;
    }

    const expression = formula.slice(1).trim();

    if (!expression.length) {
        return ERRORS.SYNTAX;
    }

    try {

        const tokens = tokenize(expression);

        let position = 0;

        function peek() {
            return tokens[position];
        }

        function consume() {
            return tokens[position++];
        }

        function parseExpression() {

            let value = parseTerm();

            while (peek() === "+" || peek() === "-") {

                const operator = consume();

                const right = parseTerm();

                value = calculate(value, operator, right);
            }

            return value;
        }

        function parseTerm() {

            let value = parseFactor();

            while (peek() === "*" || peek() === "/") {

                const operator = consume();

                const right = parseFactor();

                value = calculate(value, operator, right);
            }

            return value;
        }

        function parseFactor() {

            const token = peek();

            if (!token) {
                throw new Error();
            }


            if (token === "(") {

                consume();

                const value = parseExpression();

                if (peek() !== ")") {
                    throw new Error();
                }

                consume();

                return value;
            }


            if (token === "SUM") {
                return parseFunction("SUM");
            }


            if (token === "AVG") {
                return parseFunction("AVG");
            }


            if (isNumber(token)) {

                consume();

                return Number(token);
            }


            if (isCell(token)) {

                consume();

                return getCellValue(token, cells);
            }

            throw new Error();
        }

        function parseFunction(name) {
            consume();

            if (consume() !== "(") {
                throw new Error();
            }

            const args = [];

            if (peek() !== ")") {
                args.push(parseExpression());

                while (peek() === ",") {
                    consume();
                    args.push(parseExpression());
                }
            }

            if (consume() !== ")") {
                throw new Error();
            }

            if (name === "SUM") {
                return args.reduce((sum, value) => sum + value, 0);
            }

            if (name === "AVG") {
                if (args.length === 0) {
                    throw new Error();
                }

                return args.reduce((sum, value) => sum + value, 0) / args.length;
            }

            throw new Error();
        }

        function getCellValue(cell, cells) {
            const cellData = getCell(cell, cells);
            const value = cellData && cellData.value;

            if (value === undefined || value === null || value === "") {
                return 0;
            }

            const number = Number(value);

            if (!isNaN(number)) {
                return number;
            }

            throw new Error();
        }

        function isNumber(token) {
            return /^-?\d+(\.\d+)?$/.test(token);
        }

        function isCell(token) {
            return /^[A-Za-z]+[0-9]+$/.test(token);
        }

        function calculate(left, operator, right) {
            if (typeof left !== "number" || typeof right !== "number") {
                throw new Error();
            }

            if (operator === "+") {
                return left + right;
            }

            if (operator === "-") {
                return left - right;
            }

            if (operator === "*") {
                return left * right;
            }

            if (operator === "/") {
                if (right === 0) {
                    throw new Error(ERRORS.DIV_ZERO);
                }

                return left / right;
            }

            throw new Error();
        }

        function tokenize(expression) {
            const tokens = [];
            let token = "";

            for (let i = 0; i < expression.length; i++) {
                const char = expression[i];

                if (/\s/.test(char)) {
                    continue;
                }

                if ("()+-*/,".includes(char)) {
                    if (token) {
                        tokens.push(token);
                        token = "";
                    }

                    tokens.push(char);
                    continue;
                }

                token += char;
            }

            if (token) {
                tokens.push(token);
            }

            return tokens;
        }

        const result = parseExpression();

        return result;
    } catch (error) {
        return error.message === ERRORS.DIV_ZERO ? ERRORS.DIV_ZERO : ERRORS.SYNTAX;
    }
}


function tokenize(expression) {

    const regex =
        /SUM|AVG|[A-Z]+\d+|-?\d+(\.\d+)?|[()+\-*/:,]/g;

    const tokens = expression.match(regex);

    if (!tokens) {
        throw new Error(ERRORS.SYNTAX);
    }

    return tokens;
}


function calculate(left, operator, right) {

    if (typeof left === "string" && left.startsWith("#")) {
        return left;
    }

    if (typeof right === "string" && right.startsWith("#")) {
        return right;
    }

    if (typeof left !== "number" || typeof right !== "number") {
        return ERRORS.VALUE;
    }

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

function getCellValue(cellId, cells) {

    const cell = cells[cellId];

    if (!cell || cell.value === "" || cell.value === null || cell.value === undefined) {
        return 0;
    }

    if (typeof cell.value === "string" && cell.value.startsWith("#")) {
        return cell.value;
    }

    const value = Number(cell.value);

    if (!isNaN(value)) {
        return value;
    }

    return ERRORS.VALUE;
}

function expandRange(start, end, cells) {

    const values = [];

    const startCol = columnToNumber(start.match(/[A-Z]+/)[0]);
    const endCol = columnToNumber(end.match(/[A-Z]+/)[0]);

    const startRow = Number(start.match(/\d+/)[0]);
    const endRow = Number(end.match(/\d+/)[0]);

    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);

    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);

    for (let col = minCol; col <= maxCol; col++) {

        for (let row = minRow; row <= maxRow; row++) {

            const id = numberToColumn(col) + row;

            const value = getCellValue(id, cells);

            if (typeof value === "number") {
                values.push(value);
            }
        }
    }

    return values;
}


function columnToNumber(column) {

    let number = 0;

    for (const letter of column) {
        number = number * 26 + (letter.charCodeAt(0) - 64);
    }

    return number;
}

function numberToColumn(number) {

    let column = "";

    while (number > 0) {

        const remainder = (number - 1) % 26;

        column = String.fromCharCode(65 + remainder) + column;

        number = Math.floor((number - 1) / 26);
    }

    return column;
}


function isNumber(token) {
    return /^-?\d+(\.\d+)?$/.test(token);
}

function isCell(token) {
    return /^[A-Z]+\d+$/.test(token);
}


export function extractDependencies(formula) {

    if (!formula || !formula.startsWith("=")) {
        return [];
    }

    const matches = formula.match(/[A-Z]+\d+/g);

    if (!matches) {
        return [];
    }

    return [...new Set(matches)];
}
