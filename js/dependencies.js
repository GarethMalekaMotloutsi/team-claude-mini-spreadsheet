import { extractDependencies } from "./parser.js";

// Keeps track of which cells depend on others
export const dependents = {};

// Saves which cells depend on another cell
export function registerDeps(cellId, formula) {

    const deps = extractDependencies(formula);

    // Go through each cell this formula depends on
     deps.forEach(dep => {

        if (!dependents[dep]) {
            dependents[dep] = [];
        }

      // Save the relationship
      dependents[dep].push(cellId);

    });

}
    // Updates cells that depend on the one that changed
       export function recalculate(cellId) {

            // Start with the cell that was changed
            const queue = [cellId];
    
         while (queue.length > 0) {

        // Get the next cell that needs updating
        const current = queue.shift();

       // Get all cells that depend on the current one
       const affectedCells = dependents[current] || [];

       // Update each dependent cell
       affectedCells.forEach(cell => {

        // Add it to the queue to check its dependents
        queue.push(cell);

});
    }

       }