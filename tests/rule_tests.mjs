import { parseFormula, extractDependencies, parseRange } from '../js/parser.js';
import * as data from '../js/data.js';

const results = [];
const expect = (name, actual, expected) => {
  const pass = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  results.push({ name, pass, actual, expected });
};

// 1. Precedence and parentheses
expect('precedence 1+2*3', parseFormula('=1+2*3', {}, 'A1'), 7);
expect('parentheses (1+2)*3', parseFormula('=(1+2)*3', {}, 'A1'), 9);

// 2. Operators
expect('add 2+3', parseFormula('=2+3', {}, 'A1'), 5);
expect('sub 5-2', parseFormula('=5-2', {}, 'A1'), 3);
expect('mul 4*3', parseFormula('=4*3', {}, 'A1'), 12);
expect('div 8/2', parseFormula('=8/2', {}, 'A1'), 4);

// 3. Cell references and chain via data.commitEdit
// set A1=5, B1 = =A1+2
data.commitEdit('A1', '5');
data.commitEdit('B1', '=A1+2');
expect('chain B1 after A1=5', data.getCell('B1').value, '7');
// change A1
data.commitEdit('A1', '7');
expect('chain B1 after A1=7', data.getCell('B1').value, '9');

// 4. SUM and AVERAGE
// set A1-A5
for (let i=1;i<=5;i++) data.commitEdit('A'+i, String(i));
const cells = {};
for (let i=1;i<=5;i++) cells['A'+i] = { raw: String(i), value: String(i), deps: [] };
expect('SUM via parseFormula', parseFormula('=SUM(A1:A5)', cells, 'B1'), 15);
expect('AVERAGE via parseFormula', parseFormula('=AVERAGE(A1:A5)', cells, 'B2'), 3);

// 5. Ranges and dependency extraction
expect('parseRange A1:C1', parseRange('A1:C1').join(','), 'A1,B1,C1');
expect('extractDependencies SUM(A1:B2)+C3', extractDependencies('SUM(A1:B2)+C3').sort().join(','), 'A1,A2,B1,B2,C3');

// 6. Circular detection
data.commitEdit('C1', '=D1+1');
data.commitEdit('D1', '=C1+1');
expect('C1 circular', data.getCell('C1').value, '#CIRCULAR');
expect('D1 circular', data.getCell('D1').value, '#CIRCULAR');

// 7. Division by zero
expect('div by zero', parseFormula('=5/0', {}, 'A1'), '#DIV/0');

// 8. Arithmetic on text -> expecting #VALUE! per spec
const txtCells = { T1: { raw: 'Hello', value: 'Hello', deps: [] } };
expect('text arithmetic T1+1', parseFormula('=T1+1', txtCells, 'X1'), '#VALUE!');

// 9. Invalid syntax
expect('invalid syntax', parseFormula('=1++2', {}, 'A1'), '#ERROR');

console.log(JSON.stringify(results, null, 2));
