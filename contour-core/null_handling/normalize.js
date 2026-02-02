'use strict';

var isValidValue = require('./validate');

/**
 * Normalize null values in a grid
 * Converts all invalid values (null, undefined, NaN) to undefined
 * to match plotly.js behavior where findEmpties checks for === undefined
 *
 * Based on plotly.js src/traces/heatmap/clean_2d_array.js
 *
 * @param {Array} grid - 2D array of values (may contain null/undefined/NaN)
 * @returns {Object} Normalization result containing:
 *   - cleanedGrid: 2D array with all invalid values converted to undefined
 *   - nullMask: 2D boolean array (true = null position)
 *   - nullCount: Total number of null values
 *   - validCount: Total number of valid values
 */
function normalizeNullValues(grid) {
    if (!grid || !Array.isArray(grid) || grid.length === 0) {
        return {
            cleanedGrid: [],
            nullMask: [],
            nullCount: 0,
            validCount: 0
        };
    }

    var m = grid.length;
    var n = grid[0].length || 0;
    var cleanedGrid = [];
    var nullMask = [];
    var nullCount = 0;
    var validCount = 0;

    for (var i = 0; i < m; i++) {
        var row = grid[i];
        var cleanedRow = [];
        var maskRow = [];

        if (!row || !Array.isArray(row)) {
            // Handle missing rows - fill with undefined (not NaN)
            cleanedRow.length = n;
            for (var j = 0; j < n; j++) {
                cleanedRow[j] = undefined;
                maskRow[j] = true;
            }
            cleanedGrid.push(cleanedRow);
            nullMask.push(maskRow);
            nullCount += n;
            continue;
        }

        for (var j = 0; j < n; j++) {
            var val = row[j];

            if (isValidValue(val)) {
                cleanedRow.push(val);
                maskRow.push(false);
                validCount++;
            } else {
                // IMPORTANT: Use undefined (not NaN) to match plotly.js
                // findEmpties checks specifically for === undefined
                cleanedRow.push(undefined);
                maskRow.push(true);
                nullCount++;
            }
        }

        cleanedGrid.push(cleanedRow);
        nullMask.push(maskRow);
    }

    return {
        cleanedGrid: cleanedGrid,
        nullMask: nullMask,
        nullCount: nullCount,
        validCount: validCount
    };
}

module.exports = normalizeNullValues;
