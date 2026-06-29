# team-claude-mini-spreadsheet
Melsoft Academy Mini Spreadsheet Frontend Project - Group Claude

A browser-based spreadsheet application built from scratch using only HTML, CSS, and JavaScript. No frameworks, no libraries, no backend. Just a clean, working grid where users can type numbers, text, and formulas and watch the entire sheet respond in real time.

What It Does

- Displays a 10-column (A–J), 20-row grid
- Click any cell to select it
- Type a number, text, or a formula starting with `=` (e.g. `=A1+B2`)
- The formula bar at the top shows exactly what was typed
- The cell itself shows the calculated result
- Change one cell — every cell that depends on it updates automatically
- Circular references (e.g. A1 = =B1 and B1 = =A1) are detected and shown as `#CIRCULAR`
- Bad formulas show `#ERROR` instead of crashing


Project Structure

team-claude-mini-spreadsheet/

├── index.html          ← The single page that runs the whole app

├── css/

│   └── style.css       ← All styling for the grid and UI

└── js/

    ├── grid.js         ← Builds and renders the spreadsheet grid
    
    ├── ui.js           ← Handles user interactions (clicks, typing, selection)
    
    ├── data.js         ← Stores all cell data and manages updates
    
    ├── app.js          ← Entry point, connects all the pieces together
    
    └── config.js       ← Shared settings (rows, columns, defaults)

Team & Responsibilities

Lesedi Modikwe — Grid & Visual Layer

Files: `js/grid.js`, `css/style.css`, `index.html`

Built everything the user sees. This includes rendering the full grid as an HTML table, adding column headers (A–J) and row numbers (1–20), styling the layout so it looks and feels like a real spreadsheet, and setting up the formula bar at the top of the page. Every cell in the grid is given a `data-cell` attribute (e.g. `data-cell="B3"`) so other parts of the code can find and update it by name.

Galaletsang Modise — Data Layer

File: `js/data.js`

Built the data store — the single source of truth for everything in the spreadsheet. Every cell's contents are stored here, including what the user typed (`raw`), what the calculated result is (`value`), and which other cells it reads from (`deps`). Provides three core functions the whole team uses:

Lerato Thungo — Formula Parser

File: `js/parser.js`

Built the brain of the spreadsheet. When a cell contains something like `=A1+B2`, this code reads that instruction, finds the current values of A1 and B2, performs the calculation, and returns the result. It handles plain arithmetic (`+`, `-`, `*`, `/`), cell references, and built-in functions like `SUM(A1:A5)` and `AVERAGE`. Bad or broken formulas return `#ERROR` instead of crashing the app.

Gareth Motloutsi— Dependency Tracking & Cascade Updates

File: `js/dependencies.js` 

Built the "magic" — the part that makes the spreadsheet feel alive. Maintains a map of which cells depend on which other cells. When any cell changes, this code figures out the full chain of affected cells and recalculates them in the correct order using a BFS (queue-based) approach. This means changing A1 automatically updates B1, which automatically updates C1, and so on all the way down the chain.

Thami Sithole — Safety, Circular References & Built-in Functions

File: `js/safety.js`

Built the safety net. Detects circular references before they cause infinite loops — for example, if A1 depends on B1 and B1 depends on A1, this code catches the loop using a DFS (depth-first search) and displays `#CIRCULAR` instead of freezing the browser. Also handles edge cases like empty cells in formulas, division by zero, and text used in arithmetic. Added support for range-based functions like `SUM` and `AVERAGE`.

How to Run

1. Clone the repository:
```
git clone https://github.com/GarethMalekaMotloutsi/team-claude-mini-spreadsheet
```
2. Open the folder in VS Code
3. Install the Live Server extension if you haven't already
4. Right-click `index.html` in the file explorer
5. Click Open with Live Server
6. The spreadsheet opens in your browser at `http://localhost:5500`

No installs, no setup, no terminal commands needed beyond cloning.

How the Pieces Connect

The project uses ES Modules — JavaScript files that can share functions with each other using `import` and `export`.


index.html

    └── loads grid.js (as a module)
    
            └── grid.js builds the table, sets up the UI
            
            └── ui.js handles clicks and keyboard input
            
                    └── calls commitEdit() from data.js
                    
                            └── calls evaluate() from formula.js
                            
                            └── calls recalculate() from dependencies.js
                            
                                    └── calls hasCycle() from safety.js
                                    

Review Questions

1. Recalculation Order — How does the code decide what order to recalculate cells?

When a cell changes, the code uses BFS (Breadth First Search) — a queue-based approach. It starts with the changed cell, updates it, then looks up which cells depend on it and adds those to the queue. It works through the queue one by one until everything downstream has been updated.

2. Cycles — How does circular reference detection work for indirect loops?

The detection uses DFS (Depth First Search) — it follows the full chain of dependencies rather than just checking direct references. When you type a formula, the code traces the dependency path all the way down. If it ever arrives at a cell it has already visited in the current trace, it knows a loop exists.

3. Efficiency — Does the code recalculate everything or only what changed?

Only the affected cells are recalculated. The code maintains a reverse dependency map called `dependents` — for every cell, it stores a list of which other cells are watching it. When A1 changes, the code looks up A1's entry in that map and only recalculates the cells listed there, which in turn trigger their own dependents.

4. Design Decisions — Empty cells and one other choice

Empty cells in arithmetic— When a formula references a cell that has nothing in it, the code treats it as `0` rather than throwing an error. This matches the behaviour of real spreadsheets and means formulas work correctly even before every cell has been filled in.
Separating data from display — The data layer (`data.js`) and the visual grid (`grid.js`) are completely independent. The grid does not store any values. The data layer does not touch the screen directly except through `updateDOM`. This separation made it possible for five people to build different parts at the same time without conflicts, and made testing and debugging significantly easier because each layer could be verified on its own.



Tech Stack

- HTML5 — page structure and grid layout
- CSS3 — styling, cell selection highlights, error colours
- Vanilla JavaScript (ES Modules) — all logic, no frameworks
- Live Server — local development server for testing

