'use strict';

/**
 * Compute contour levels from data and options
 */

/**
 * Calculate contour levels based on options
 *
 * @param {Object} options - Contour options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Boolean} options.autocontour - Auto-generate contour levels
 * @param {Number} options.start - Start value for contours
 * @param {Number} options.end - End value for contours
 * @param {Number} options.size - Step size between contours
 * @param {Number} options.ncontours - Approximate number of contours (for auto mode)
 * @param {Array} vals - 2D array of z values
 * @returns {Array} Array of contour level values
 */
function setContours(options, vals) {
    var levels = [];

    // Check if we have custom thresholds - highest priority
    if (options.thresholds && Array.isArray(options.thresholds) && options.thresholds.length > 0) {
        // Validate and sort thresholds
        levels = options.thresholds.slice().sort(function(a, b) {
            return a - b;
        });

        // Filter out non-numeric values
        levels = levels.filter(function(val) {
            return typeof val === 'number' && !isNaN(val) && isFinite(val);
        });

        if (levels.length > 0) {
            return levels;
        }
    }

    // Auto-generate contour levels
    if (options.autocontour) {
        // Flatten and filter out NaN/null values
        var flatVals = vals.flat().filter(function(v) {
            return typeof v === 'number' && !isNaN(v) && isFinite(v);
        });

        if (flatVals.length === 0) {
            return [];  // No valid data
        }

        var zmin = Math.min.apply(Math, flatVals);
        var zmax = Math.max.apply(Math, flatVals);

        var start, end, size;

        if (typeof options.start === 'number') {
            start = options.start;
        } else {
            start = zmin;
        }

        if (typeof options.end === 'number') {
            end = options.end;
        } else {
            end = zmax;
        }

        var ncontours = options.ncontours || 15;
        size = (end - start) / (ncontours - 1);

        if (size <= 0) {
            size = 1;
        }

        // Generate levels
        for (var val = start; val <= end + size * 0.0001; val += size) {
            levels.push(Math.round(val * 10000) / 10000); // Round to avoid floating point issues
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    } else {
        // Manual contour levels
        var start = options.start || 0;
        var end = options.end || 100;
        var size = options.size || 1;

        if (start > end) {
            var temp = start;
            start = end;
            end = temp;
        }

        if (size <= 0) {
            size = 1;
        }

        // Generate levels
        for (var val = start; val <= end + size * 0.0001; val += size) {
            levels.push(Math.round(val * 10000) / 10000);
        }

        // Remove duplicates and sort
        levels = uniqueSorted(levels);
    }

    return levels;
}

/**
 * Remove duplicates and sort array
 */
function uniqueSorted(arr) {
    var seen = {};
    var out = [];
    for (var i = 0; i < arr.length; i++) {
        var val = arr[i];
        if (!seen[val]) {
            seen[val] = true;
            out.push(val);
        }
    }
    return out.sort(function(a, b) { return a - b; });
}

/**
 * Calculate the end value for contours (inclusive)
 */
function endPlus(contours) {
    var end = contours.end;
    var size = contours.size;

    if (!isFinite(size)) {
        size = 1;
    }

    // Add a small fraction to make the end inclusive
    return end + size * 0.0001;
}

module.exports = {
    setContours: setContours,
    endPlus: endPlus
};
