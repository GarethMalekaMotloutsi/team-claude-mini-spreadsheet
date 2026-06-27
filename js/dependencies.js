// Keeps track of which cells depend on others
export const dependents = {};

// Saves which cells depend on another cell
export function registerDeps(cellId, deps) {

    // Start with the cell that was changed
    const queue = [cellId];
    
    while (queue.length > 0) {

    }

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

       }