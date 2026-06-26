
class SpreadsheetGrid {
    constructor(containerId, rows = 20, cols = 10) {
        this.container = document.getElementById("sheetgrid");
        this.rows = rows;
        this.cols = cols;
        // e.g. "A1"
        this.selectedCell = null; 

        // method calls
        this.render();
        this.attachEvents();
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

}

const sheet = new SpreadsheetGrid("sheetgrid");