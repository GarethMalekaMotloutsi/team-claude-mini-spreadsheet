import { getCell, commitEdit } from './data.js';

class SpreadsheetGrid {
    constructor(rows = 20, cols = 10) {
        this.container = document.getElementById("sheetgrid");
        if (!this.container) {
            return;
        }

        this.rows = rows;
        this.cols = cols;
        this.selectedCell = null;

        this.render();
        this.attachEvents();
        this.selectCell("A1");
        this.container.style.display = 'block';
    }

    // Building the grid DOM
    render() {
        // creating table element
        const table = document.createElement("table");

        // header row and the empty corner on the top left
        const headerRow = document.createElement("tr");
        const cornerCell = document.createElement("th");
        headerRow.appendChild(cornerCell);

        // loop to count from 0-9 which is A - J and return a letter for every count 65 = "A" in ASCII
        for (let c = 0; c < this.cols; c++) {
            const th = document.createElement("th");
            th.textContent = String.fromCharCode(65 + c);
            headerRow.appendChild(th);
        }
        table.appendChild(headerRow);

        // Data rows (1-20)
        for (let r = 1; r <= this.rows; r++) {
            const tr = document.createElement("tr");

            const rowHeader = document.createElement("th");
            rowHeader.textContent = r;
            tr.appendChild(rowHeader);

            // CELLS A1-J1, A2-J2 etc...
            for (let c = 0; c < this.cols; c++) {
                const td = document.createElement("td");
                const colLetter = String.fromCharCode(65 + c);
                const cellId = `${colLetter}${r}`;
                td.setAttribute("data-cell", cellId);
                td.textContent = "";
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
        this.container.appendChild(table);
    }

    // Click, keydown, arrow keys (EVENT LISTENERS)
    attachEvents() {
        // Click to select a cell
        this.container.addEventListener("click", (e) => {
            const cell = e.target.closest("[data-cell]");
            if (cell) {
            this.selectCell(cell.getAttribute("data-cell"));
            }
        });

        // arrow key navigation
        document.addEventListener("keydown", (e) => {
            if (!this.selectedCell) return;

            // ignoring arrow keys when formula bar is focused
            if (document.activeElement === document.getElementById("formulainput")) return;

            // reading current cell position
            const col = this.selectedCell.charCodeAt(0);
            const row = parseInt(this.selectedCell.slice(1));


            let newCol = col;
            let newRow = row;

            // depending on which arrow key was pressed, add or subtract 1 from the row or column number.
            if (e.key === "ArrowUp")    newRow--;
            if (e.key === "ArrowDown")  newRow++;
            if (e.key === "ArrowLeft")  newCol--;
            if (e.key === "ArrowRight") newCol++;

            // Stay within bounds, stops from going off the edge
            newCol = Math.max(65, Math.min(65 + this.cols - 1, newCol));
            newRow = Math.max(1, Math.min(this.rows, newRow));

            // Converts the numbers back into a cell ID string like "C5" and calls selectCell() to move there
            const newCellId = `${String.fromCharCode(newCol)}${newRow}`;
            this.selectCell(newCellId);
        });

        // watches the formula bar input for when the user presses Enter.
        document.getElementById("formulainput").addEventListener("keydown", (e) => {
            if (e.key === "Enter" && this.selectedCell) {
                console.log("ENTER PRESSED");

                const raw = document.getElementById("formulainput").value;
                commitEdit(this.selectedCell, raw);
            }
        });

        // function to be able to type directly in the cell not just input bar
        document.addEventListener("keydown", (e) => {
            if (document.activeElement === document.getElementById("formulainput")) return;
            if (!this.selectedCell) return;
            if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return;

            // handle backspace to clear the cell
            if(e.key === "Backspace"){
                e.preventDefault();
                const input = document.getElementById("formulainput");
                 input.value = "";
                input.dispatchEvent(new Event("input", { bubbles: true }));
                commitEdit(this.selectedCell, "");
                return;
            }

            // ignore shift, backspace, tab etc
            if (e.key.length !== 1) return;

            // ignore Ctrl+C, Cmd+V, Alt+anything
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            // preventing the browsers native typing behaviour
            e.preventDefault();

            const input = document.getElementById("formulainput");
            input.value = e.key;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.focus();
        });

        // function to see everything you type on the cell live not just the input bar
        document.getElementById("formulainput").addEventListener("input", (e) => {
            if (this.selectedCell) {
                const td = document.querySelector(`[data-cell="${this.selectedCell}"]`);
                if (td) td.textContent = e.target.value;
            }
        });
    }

    // Highlight the cell, update formula bar label
    selectCell(cellId) {
        // Remove highlight from previous cell
        if (this.selectedCell) {
            const prev = this.container.querySelector(`[data-cell="${this.selectedCell}"]`);
            if (prev) prev.classList.remove("selected");
        }

        // Update selected cell
        this.selectedCell = cellId;

        // Highlight new cell
        const cell = this.container.querySelector(`[data-cell="${cellId}"]`);
            if (cell) cell.classList.add("selected");

        // Update formula bar label
        document.getElementById("celllabel").textContent = cellId;

        // show raw value in the formula bar
        document.getElementById("formulainput").value = getCell(cellId).raw;
    }
}
window.addEventListener('load', () => {
    new SpreadsheetGrid();
});
