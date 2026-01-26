'use strict';

/**
 * Generate a boolean mask indicating null value positions in a grid
 *
 * @param {Array} grid - 2D array of values
 * @returns {Array} 2D boolean array where true indicates a null/invalid value
 */
function generateNullMask(grid) {
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
        return [];
    }

    var m = grid.length;
    var mask = [];

    for (var i = 0; i < m; i++) {
        var row = grid[i];

        if (!row || !Array.isArray(row)) {
            // Handle missing rows - treat as all null
            mask.push([]);
            continue;
        }

        var maskRow = [];
        for (var j = 0; j < row.length; j++) {
            var val = row[j];
            var isNull = val === null ||
                        val === undefined ||
                        (typeof val === 'number' && isNaN(val));
            maskRow.push(isNull);
        }
        mask.push(maskRow);
    }

    return mask;
}

module.exports = generateNullMask;
