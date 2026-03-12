/**
 * contour-core v0.2.0 - Standalone Contour Calculation Library
 * Features: Null value support + Simplified rendering API
 * License: MIT
 *
 * Extracted from Plotly.js for SSR and performance optimization
 */

(function (root, factory) {
    'use strict';

    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ContourCore = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ============================================
    // NULL HANDLING MODULE
    // ============================================

    /**
 * Check if a value is valid (not null, undefined, or NaN)
 *
 * @param {*} val - Value to check
 * @returns {Boolean} True if value is valid
 */
function isValidValue(val) {
    return val !== null &&
           val !== undefined &&
           (typeof val === 'number') &&
           !isNaN(val) &&
           isFinite(val);
}

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

    var nullHandling = {
        isValidValue: isValidValue,
        normalizeNullValues: normalizeNullValues,
        generateNullMask: generateNullMask
    };

    // ============================================
    // CONSTANTS
    // ============================================
    var constants = {


    BOTTOMSTART: [1, 9, 13, 104, 713],
    TOPSTART: [4, 6, 7, 104, 713],
    LEFTSTART: [8, 12, 14, 208, 1114],
    RIGHTSTART: [2, 3, 11, 208, 1114],
    NEWDELTA: [
        null, [-1, 0], [0, -1], [-1, 0],
        [1, 0], null, [0, -1], [-1, 0],
        [0, 1], [0, 1], null, [0, 1],
        [1, 0], [1, 0], [0, -1]
    ],
    CHOOSESADDLE: {
        104: [4, 1],
        208: [2, 8],
        713: [7, 13],
        1114: [11, 14]
    },
    SADDLEREMAINDER: {1: 4, 2: 8, 4: 1, 7: 13, 8: 2, 11: 14, 13: 7, 14: 11},
    LABELDISTANCE: 2,
    LABELINCREASE: 10,
    LABELMIN: 3,
    LABELMAX: 10,
    LABELOPTIMIZER: {
        EDGECOST: 1,
        ANGLECOST: 1,
        NEIGHBORCOST: 5,
        SAMELEVELFACTOR: 10,
        SAMELEVELDISTANCE: 5,
        MAXCOST: 100,
        INITIALSEARCHPOINTS: 10,
        ITERATIONS: 5
    }

};

    // ============================================
    // LEVELS
    // ============================================
    /**
 * Compute contour levels from data and options
 */

/**
 * Calculate contour levels based on options
 *
 * @param {Object} options - Contour options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Array} options.valueColorMap - Value-color map in [[value, color], ...] format (optional, highest priority)
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

    // HIGHEST PRIORITY: valueColorMap - Extract threshold values from [[value, color], ...] format
    // This format defines segmented color mapping where each value is a boundary
    // Example: [[10, '#300030'], [20, '#ff453'], [30, '#ff5663']]
    //          means: value < 10 uses '#300030', 10-20 uses '#ff453', 20-30 uses '#ff5663'
    if (options.valueColorMap && Array.isArray(options.valueColorMap) && options.valueColorMap.length > 0) {
        // Validate valueColorMap format: [[value, color], ...]
        var isValidFormat = options.valueColorMap.every(function(item) {
            return Array.isArray(item) && item.length >= 2 &&
                   typeof item[0] === 'number' && typeof item[1] === 'string';
        });

        if (isValidFormat) {
            // Extract threshold values and sort
            levels = options.valueColorMap.map(function(item) {
                return item[0];
            }).sort(function(a, b) {
                return a - b;
            });

            // Remove duplicates
            levels = uniqueSorted(levels);

            if (levels.length > 0) {
                return levels;
            }
        }
    }

    // Check if we have custom thresholds - second priority
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
        // Flatten array manually to avoid stack overflow with large arrays
        // (Array.flat() may use recursive implementation in some JS engines)
        var flatVals = [];
        for (var rowIdx = 0; rowIdx < vals.length; rowIdx++) {
            var row = vals[rowIdx];
            if (row) {
                for (var colIdx = 0; colIdx < row.length; colIdx++) {
                    var v = row[colIdx];
                    if (typeof v === 'number' && !isNaN(v) && isFinite(v)) {
                        flatVals.push(v);
                    }
                }
            }
        }

        if (flatVals.length === 0) {
            return [];  // No valid data
        }

        var zmin = Math.min.apply(Math, flatVals);
        var zmax = Math.max.apply(Math, flatVals);

        var start, end;

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

        // Use smart tick algorithm to generate "nice" contour levels
        var smartTicks = computeNiceTicks(start, end, ncontours);

        // Generate levels using nice ticks
        for (var val = smartTicks.start;
             val <= smartTicks.end + smartTicks.step * 0.0001;
             val += smartTicks.step) {
            levels.push(val);
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
 * Compute "nice" tick values for contour levels
 * Based on Plotly's Axes.autoTicks algorithm
 *
 * This generates aesthetically pleasing tick values like 1, 2, 5, 10
 * instead of arbitrary values like 1.234, 2.468, 3.702
 *
 * @param {Number} start - Start value
 * @param {Number} end - End value
 * @param {Number} ncontours - Desired number of contours
 * @returns {Object} Object with {start, end, step}
 */
function computeNiceTicks(start, end, ncontours) {
    var range = end - start;

    // Handle degenerate cases
    if (range <= 0) {
        return {
            start: start,
            end: end,
            step: 1
        };
    }

    // Calculate rough step size
    var roughStep = range / (ncontours || 15);

    // Avoid zero or very small steps
    if (roughStep <= 0) {
        roughStep = 1;
    }

    // Calculate the exponent (power of 10)
    var exponent = Math.floor(Math.log10(roughStep));

    // Normalize the step to be between 1 and 10
    var fraction = roughStep / Math.pow(10, exponent);

    // Choose a "nice" fraction
    // These are the preferred numbers: 1, 2, 5, 10
    var niceFraction;

    if (fraction < 1.5) {
        niceFraction = 1;
    } else if (fraction < 3) {
        niceFraction = 2;
    } else if (fraction < 7) {
        niceFraction = 5;
    } else {
        niceFraction = 10;
    }

    // Calculate the nice step size
    var step = niceFraction * Math.pow(10, exponent);

    // Adjust the start to be a multiple of the step
    // This ensures ticks align on nice boundaries
    var adjustedStart;

    if (start >= 0) {
        adjustedStart = Math.ceil(start / step) * step;
    } else {
        adjustedStart = Math.floor(start / step) * step;
    }

    // Make sure we don't go below the original start
    if (adjustedStart > start) {
        adjustedStart -= step;
    }

    // Adjust the end to be a multiple of the step
    var adjustedEnd;

    if (end >= 0) {
        adjustedEnd = Math.floor(end / step) * step;
    } else {
        adjustedEnd = Math.ceil(end / step) * step;
    }

    // Make sure we don't go above the original end
    if (adjustedEnd < end) {
        adjustedEnd += step;
    }

    // Handle edge case where range is too small
    if (adjustedEnd <= adjustedStart) {
        adjustedEnd = adjustedStart + step;
    }

    // Round to appropriate precision to avoid floating point issues
    var precision = Math.max(0, -exponent);

    return {
        start: roundToPrecision(adjustedStart, precision),
        end: roundToPrecision(adjustedEnd, precision),
        step: roundToPrecision(step, precision)
    };
}

/**
 * Round a number to a specified precision
 *
 * @param {Number} value - Value to round
 * @param {Number} precision - Number of decimal places
 * @returns {Number} Rounded value
 */
function roundToPrecision(value, precision) {
    if (precision <= 0) {
        return Math.round(value);
    }

    var factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
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

    // ============================================
    // SMOOTH
    // ============================================
    /**
 * Path smoothing utilities using Catmull-Rom splines
 * Based on: http://www.cemyuksel.com/research/catmullrom_param/catmullrom.pdf
 */

// Catmull-Rom exponent (0.5 is the standard value)
var CatmullRomExp = 0.5;

/**
 * Smooth an open path (not closed) using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothopen(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L');
    }
    var path = 'M' + pts[0];
    var tangents = [];
    var i;
    for (i = 1; i < pts.length - 1; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    path += 'Q' + tangents[0][0] + ' ' + pts[1];
    for (i = 2; i < pts.length - 1; i++) {
        path += 'C' + tangents[i - 2][1] + ' ' + tangents[i - 1][0] + ' ' + pts[i];
    }
    path += 'Q' + tangents[pts.length - 3][1] + ' ' + pts[pts.length - 1];
    return path;
}

/**
 * Smooth a closed path using Catmull-Rom splines
 * @param {Array} pts - Array of [x, y] points
 * @param {Number} smoothness - Smoothing factor (0-1)
 * @returns {String} SVG path string
 */
function smoothclosed(pts, smoothness) {
    if (pts.length < 3) {
        return 'M' + pts.join('L') + 'Z';
    }
    var path = 'M' + pts[0];
    var pLast = pts.length - 1;
    var tangents = [makeTangent(pts[pLast], pts[0], pts[1], smoothness)];
    var i;
    for (i = 1; i < pLast; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }
    tangents.push(makeTangent(pts[pLast - 1], pts[pLast], pts[0], smoothness));

    for (i = 1; i <= pLast; i++) {
        path += 'C' + tangents[i - 1][1] + ' ' + tangents[i][0] + ' ' + pts[i];
    }
    path += 'C' + tangents[pLast][1] + ' ' + tangents[0][0] + ' ' + pts[0] + 'Z';
    return path;
}

/**
 * Create tangent points for Catmull-Rom spline interpolation
 * @param {Array} prevpt - Previous point [x, y]
 * @param {Array} thispt - Current point [x, y]
 * @param {Array} nextpt - Next point [x, y]
 * @param {Number} smoothness - Smoothing factor
 * @returns {Array} Array of two tangent points [[x1, y1], [x2, y2]]
 */
function makeTangent(prevpt, thispt, nextpt, smoothness) {
    var d1x = prevpt[0] - thispt[0];
    var d1y = prevpt[1] - thispt[1];
    var d2x = nextpt[0] - thispt[0];
    var d2y = nextpt[1] - thispt[1];
    var d1a = Math.pow(d1x * d1x + d1y * d1y, CatmullRomExp / 2);
    var d2a = Math.pow(d2x * d2x + d2y * d2y, CatmullRomExp / 2);
    var numx = (d2a * d2a * d1x - d1a * d1a * d2x) * smoothness;
    var numy = (d2a * d2a * d1y - d1a * d1a * d2y) * smoothness;
    var denom1 = 3 * d2a * (d1a + d2a);
    var denom2 = 3 * d1a * (d1a + d2a);
    return [
        [
            round(thispt[0] + (denom1 && numx / denom1)),
            round(thispt[1] + (denom1 && numy / denom1))
        ],
        [
            round(thispt[0] - (denom2 && numx / denom2)),
            round(thispt[1] - (denom2 && numy / denom2))
        ]
    ];
}

/**
 * Round a number to 2 decimal places
 */
function round(v) {
    return Math.round(v * 100) / 100;
}

    // ============================================
    // MARCHING SQUARES
    // ============================================
    /**
 * Calculate all the marching indices for ALL levels at once.
 * Uses an exhaustive approach - checks for contour crossings
 * at every intersection rather than just following a path.
 *
 * @param {Array} pathinfo - Array of path info objects, one per contour level
 *   Each pathinfo object should have:
 *   - level: the contour level value
 *   - crossings: object to store crossing data
 *   - starts: array to store starting points
 *   - z: 2D array of z values
 */
function makeCrossings(pathinfo) {
    var z = pathinfo[0].z;
    var m = z.length;
    var n = z[0].length;
    var twoWide = m === 2 || n === 2;
    var xi, yi, startIndices, ystartIndices, label, corners, mi, pi, i;

    for (yi = 0; yi < m - 1; yi++) {
        ystartIndices = [];
        if (yi === 0) ystartIndices = ystartIndices.concat(constants.BOTTOMSTART);
        if (yi === m - 2) ystartIndices = ystartIndices.concat(constants.TOPSTART);

        for (xi = 0; xi < n - 1; xi++) {
            startIndices = ystartIndices.slice();
            if (xi === 0) startIndices = startIndices.concat(constants.LEFTSTART);
            if (xi === n - 2) startIndices = startIndices.concat(constants.RIGHTSTART);

            // Get corner values for this cell
            corners = [[z[yi][xi], z[yi][xi + 1]],
                       [z[yi + 1][xi], z[yi + 1][xi + 1]]];

            label = xi + ',' + yi;

            for (i = 0; i < pathinfo.length; i++) {
                pi = pathinfo[i];
                mi = getMarchingIndex(pi.level, corners);
                if (!mi) continue;

                pi.crossings[label] = mi;
                if (startIndices.indexOf(mi) !== -1) {
                    pi.starts.push([xi, yi]);
                    if (twoWide && startIndices.indexOf(mi, startIndices.indexOf(mi) + 1) !== -1) {
                        // The same square has starts from opposite sides
                        pi.starts.push([xi, yi]);
                    }
                }
            }
        }
    }
}

/**
 * Modified marching squares algorithm with saddle point disambiguation.
 * Ignores cases with no crossings.
 *
 * Index based on: http://en.wikipedia.org/wiki/Marching_squares
 * Saddles bifurcate and are represented as the decimal combination
 * of the two appropriate non-saddle indices.
 *
 * @param {Number} val - Contour level value
 * @param {Array} corners - 2x2 array of corner values [[z00, z01], [z10, z11]]
 * @returns {Number} Marching index (0-15 for standard, >100 for saddle points)
 */
function getMarchingIndex(val, corners) {
    var mi = (corners[0][0] > val ? 0 : 1) +
             (corners[0][1] > val ? 0 : 2) +
             (corners[1][1] > val ? 0 : 4) +
             (corners[1][0] > val ? 0 : 8);

    if (mi === 5 || mi === 10) {
        var avg = (corners[0][0] + corners[0][1] +
                   corners[1][0] + corners[1][1]) / 4;
        // Two peaks with a big valley
        if (val > avg) return (mi === 5) ? 713 : 1114;
        // Two valleys with a big ridge
        return (mi === 5) ? 104 : 208;
    }
    return (mi === 15) ? 0 : mi;
}

    // ============================================
    // PATHFINDING
    // ============================================
    /**
 * Find all contour paths from the crossing data generated by marching squares.
 *
 * @param {Array} pathinfo - Array of path info objects with crossings data
 * @param {Number} xtol - X tolerance for considering points equal (default 0.01)
 * @param {Number} ytol - Y tolerance for considering points equal (default 0.01)
 */
function findAllPaths(pathinfo, xtol, ytol) {
    var cnt, startLoc, i, pi, j;

    // Default tolerance values
    xtol = xtol || 0.01;
    ytol = ytol || 0.01;

    for (i = 0; i < pathinfo.length; i++) {
        pi = pathinfo[i];

        // Process all edge paths (paths that start at the boundary)
        for (j = 0; j < pi.starts.length; j++) {
            startLoc = pi.starts[j];
            makePath(pi, startLoc, 'edge', xtol, ytol);
        }

        // Process all interior paths
        cnt = 0;
        while (Object.keys(pi.crossings).length && cnt < 10000) {
            cnt++;
            startLoc = Object.keys(pi.crossings)[0].split(',').map(Number);
            makePath(pi, startLoc, undefined, xtol, ytol);
        }
        if (cnt === 10000) {
            console.warn('Infinite loop in contour calculation');
        }
    }
}

/**
 * Check if two points are equal within tolerance
 */
function equalPts(pt1, pt2, xtol, ytol) {
    return Math.abs(pt1[0] - pt2[0]) < xtol &&
           Math.abs(pt1[1] - pt2[1]) < ytol;
}

/**
 * Calculate distance in index units between two points
 * Uses the 3rd and 4th items in points (grid indices)
 */
function ptDist(pt1, pt2) {
    var dx = pt1[2] - pt2[2];
    var dy = pt1[3] - pt2[3];
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Make a single contour path starting from a given location
 *
 * @param {Object} pi - Path info object for this contour level
 * @param {Array} loc - Starting location [xi, yi]
 * @param {String} edgeflag - 'edge' if this is an edge path, undefined otherwise
 * @param {Number} xtol - X tolerance
 * @param {Number} ytol - Y tolerance
 */
function makePath(pi, loc, edgeflag, xtol, ytol) {
    var locStr = loc.join(',');
    var mi = pi.crossings[locStr];
    var marchStep = getStartStep(mi, edgeflag, loc);

    // Start by going backward a half step and finding the crossing point
    var pts = [getInterpPx(pi, loc, [-marchStep[0], -marchStep[1]])];
    var m = pi.z.length;
    var n = pi.z[0].length;
    var startLoc = loc.slice();
    var startStep = marchStep.slice();
    var cnt;

    // Now follow the path
    for (cnt = 0; cnt < 10000; cnt++) {
        if (mi > 20) {
            mi = constants.CHOOSESADDLE[mi][(marchStep[0] || marchStep[1]) < 0 ? 0 : 1];
            pi.crossings[locStr] = constants.SADDLEREMAINDER[mi];
        } else {
            delete pi.crossings[locStr];
        }

        marchStep = constants.NEWDELTA[mi];
        if (!marchStep) {
            console.warn('Found bad marching index:', mi, loc, pi.level);
            break;
        }

        // Find the crossing a half step forward, then take the full step
        pts.push(getInterpPx(pi, loc, marchStep));
        loc[0] += marchStep[0];
        loc[1] += marchStep[1];
        locStr = loc.join(',');

        // Don't include the same point multiple times
        if (equalPts(pts[pts.length - 1], pts[pts.length - 2], xtol, ytol)) {
            pts.pop();
        }

        var atEdge = (marchStep[0] && (loc[0] < 0 || loc[0] > n - 2)) ||
                (marchStep[1] && (loc[1] < 0 || loc[1] > m - 2));

        var closedLoop = loc[0] === startLoc[0] && loc[1] === startLoc[1] &&
                marchStep[0] === startStep[0] && marchStep[1] === startStep[1];

        // Have we completed a loop, or reached an edge?
        if (closedLoop || (edgeflag && atEdge)) break;

        mi = pi.crossings[locStr];
    }

    if (cnt === 10000) {
        console.warn('Infinite loop in contour path');
    }

    var closedpath = equalPts(pts[0], pts[pts.length - 1], xtol, ytol);

    // Simplify path by removing points that are too close together
    var simplifiedPts = simplifyPath(pts, pi.smoothing, closedpath);

    // Remove index parts (3rd and 4th items) before storing
    for (cnt = 0; cnt < simplifiedPts.length; cnt++) {
        simplifiedPts[cnt].length = 2;
    }

    // Don't return single-point paths
    if (simplifiedPts.length < 2) return;

    if (closedpath) {
        pi.paths.push(simplifiedPts);
    } else {
        // Edge path - merge with existing edge paths if possible
        mergeEdgePath(pi, simplifiedPts, xtol, ytol);
    }
}

/**
 * Simplify path by removing points that are too close together
 */
function simplifyPath(pts, smoothing, closedpath) {
    var totaldist = 0;
    var alldists = [];
    var cnt;

    // Calculate all distances
    for (cnt = 1; cnt < pts.length; cnt++) {
        var thisdist = ptDist(pts[cnt], pts[cnt - 1]);
        totaldist += thisdist;
        alldists.push(thisdist);
    }

    if (alldists.length === 0) return pts;

    var distThresholdFactor = 0.2 * smoothing;
    var distThreshold = totaldist / alldists.length * distThresholdFactor;

    var result = [];
    var cropstart = 0;
    var i, cnt2, cnt3, newpt, ptavg, distgroup;

    function getpt(i) { return pts[i % pts.length]; }

    for (cnt = pts.length - 2; cnt >= cropstart; cnt--) {
        distgroup = alldists[cnt];
        if (distgroup < distThreshold) {
            cnt3 = 0;
            for (cnt2 = cnt - 1; cnt2 >= cropstart; cnt2--) {
                if (distgroup + alldists[cnt2] < distThreshold) {
                    distgroup += alldists[cnt2];
                } else break;
            }

            // Closed path with close points wrapping around the boundary?
            if (closedpath && cnt === pts.length - 2) {
                for (cnt3 = 0; cnt3 < cnt2; cnt3++) {
                    if (distgroup + alldists[cnt3] < distThreshold) {
                        distgroup += alldists[cnt3];
                    } else break;
                }
            }

            var ptcnt = cnt - cnt2 + cnt3 + 1;
            ptavg = Math.floor((cnt + cnt2 + cnt3 + 2) / 2);

            // Keep endpoints for open paths
            if (!closedpath && cnt === pts.length - 2) {
                newpt = pts[pts.length - 1];
            } else if (!closedpath && cnt2 === -1) {
                newpt = pts[0];
            } else if (ptcnt % 2) {
                // Odd number of points - take the central one
                newpt = getpt(ptavg);
            } else {
                // Even number of points - average central two
                newpt = [
                    (getpt(ptavg)[0] + getpt(ptavg + 1)[0]) / 2,
                    (getpt(ptavg)[1] + getpt(ptavg + 1)[1]) / 2,
                    getpt(ptavg)[2],
                    getpt(ptavg)[3]
                ];
            }

            pts.splice(cnt2 + 1, cnt - cnt2 + 1, newpt);
            cnt = cnt2 + 1;
            if (cnt3) cropstart = cnt3;
            if (closedpath) {
                if (cnt === pts.length - 2) pts[cnt3] = pts[pts.length - 1];
                else if (cnt === 0) pts[pts.length - 1] = pts[0];
            }
        }
    }

    pts.splice(0, cropstart);
    return pts;
}

/**
 * Merge an edge path with existing edge paths if they connect
 */
function mergeEdgePath(pi, pts, xtol, ytol) {
    var merged = false;
    var i, j, edgepathi, edgepathj;

    // Try to connect the end of pts to the start of an existing path
    for (i = 0; i < pi.edgepaths.length; i++) {
        edgepathi = pi.edgepaths[i];
        if (!merged && equalPts(edgepathi[0], pts[pts.length - 1], xtol, ytol)) {
            pts.pop();
            merged = true;

            // Check if it ALSO meets the end of another (or the same) path
            var doublemerged = false;
            for (j = 0; j < pi.edgepaths.length; j++) {
                edgepathj = pi.edgepaths[j];
                if (equalPts(edgepathj[edgepathj.length - 1], pts[0], xtol, ytol)) {
                    doublemerged = true;
                    pts.shift();
                    pi.edgepaths.splice(i, 1);
                    if (j === i) {
                        // The path is now closed
                        pi.paths.push(pts.concat(edgepathj));
                    } else {
                        if (j > i) j--;
                        pi.edgepaths[j] = edgepathj.concat(pts, edgepathi);
                    }
                    break;
                }
            }
            if (!doublemerged) {
                pi.edgepaths[i] = pts.concat(edgepathi);
            }
        }
    }

    // Try to connect the start of pts to the end of an existing path
    for (i = 0; i < pi.edgepaths.length; i++) {
        if (merged) break;
        edgepathi = pi.edgepaths[i];
        if (equalPts(edgepathi[edgepathi.length - 1], pts[0], xtol, ytol)) {
            pts.shift();
            pi.edgepaths[i] = edgepathi.concat(pts);
            merged = true;
        }
    }

    if (!merged) {
        pi.edgepaths.push(pts);
    }
}

/**
 * Get the marching step for the first point in the path
 */
function getStartStep(mi, edgeflag, loc) {
    var dx = 0;
    var dy = 0;

    if (mi > 20 && edgeflag) {
        // Saddles start at +/- x
        if (mi === 208 || mi === 1114) {
            dx = loc[0] === 0 ? 1 : -1;
        } else {
            dy = loc[1] === 0 ? 1 : -1;
        }
    } else if (constants.BOTTOMSTART.indexOf(mi) !== -1) {
        dy = 1;
    } else if (constants.LEFTSTART.indexOf(mi) !== -1) {
        dx = 1;
    } else if (constants.TOPSTART.indexOf(mi) !== -1) {
        dy = -1;
    } else {
        dx = -1;
    }
    return [dx, dy];
}

/**
 * Find the pixel coordinates of a particular crossing
 * Enhanced version with support for data space interpolation
 *
 * @param {Object} pi - Path info object at this level
 * @param {Array} loc - Grid index [x, y] of the crossing
 * @param {Array} step - Direction [dx, dy] we're moving on the grid
 * @param {Object} scaleFunctions - Optional scale functions {xa, ya, x, y}
 * @returns {Array} [xpx, ypx, xi, yi] - interpolated location + grid indices
 */
function getInterpPx(pi, loc, step, scaleFunctions) {
    var locx = loc[0] + Math.max(step[0], 0);
    var locy = loc[1] + Math.max(step[1], 0);
    var zxy = pi.z[locy][locx];

    // Default to grid index space if no scale functions provided
    var x = scaleFunctions && scaleFunctions.x ? scaleFunctions.x : pi.x;
    var y = scaleFunctions && scaleFunctions.y ? scaleFunctions.y : pi.y;

    if (step[1]) {
        // Horizontal edge - interpolate in X direction
        var dx = (pi.level - zxy) / (pi.z[locy][locx + 1] - zxy);

        // Protect against division by zero or invalid values
        if (!isFinite(dx)) dx = 0.5;

        // Interpolate in data space (supports non-uniform grids)
        var dataX;
        if (dx !== 1 && dx !== 0) {
            dataX = (1 - dx) * x[locx] + dx * x[locx + 1];
        } else if (dx === 1) {
            dataX = x[locx + 1];
        } else {
            dataX = x[locx];
        }

        var dataY = y[locy];

        return [
            dataX,      // X in data space
            dataY,      // Y in data space
            locx + dx,  // Interpolated grid index X
            locy        // Grid index Y
        ];
    } else {
        // Vertical edge - interpolate in Y direction
        var dy = (pi.level - zxy) / (pi.z[locy + 1][locx] - zxy);

        // Protect against division by zero or invalid values
        if (!isFinite(dy)) dy = 0.5;

        // Interpolate in data space (supports non-uniform grids)
        var dataX = x[locx];
        var dataY;
        if (dy !== 1 && dy !== 0) {
            dataY = (1 - dy) * y[locy] + dy * y[locy + 1];
        } else if (dy === 1) {
            dataY = y[locy + 1];
        } else {
            dataY = y[locy];
        }

        return [
            dataX,      // X in data space
            dataY,      // Y in data space
            locx,       // Grid index X
            locy + dy   // Interpolated grid index Y
        ];
    }
}

    // ============================================
    // CANVAS RENDERER
    // ============================================
    /**
 * Canvas renderer for contour-core
 * Main entry point for canvas rendering
 */


/**
 * Calculate adjusted drawing area based on aspect ratio
 * When aspectRatio is 'equal' or 1, the drawing area is adjusted so that
 * one unit of data in X direction equals one unit of data in Y direction on screen
 *
 * @param {Object} baseArea - Base drawing area { x, y, width, height, margins }
 * @param {Object} fullRange - Data range { xMin, xMax, yMin, yMax }
 * @param {string|number} aspectRatio - 'equal' or 1 for 1:1 ratio, 'auto' or 0 for fill
 * @returns {Object} Adjusted drawing area
 */
function calculateAspectRatioDrawingArea(baseArea, fullRange, aspectRatio) {
    // If aspectRatio is not 'equal' or 1, return base area unchanged
    if (aspectRatio !== 'equal' && aspectRatio !== 1 && aspectRatio !== '1:1') {
        return baseArea;
    }

    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    // Avoid division by zero
    if (xRange === 0 || yRange === 0) {
        return baseArea;
    }

    // Data aspect ratio (width per unit / height per unit)
    var dataRatio = xRange / yRange;

    // Available canvas aspect ratio
    var canvasRatio = baseArea.width / baseArea.height;

    var adjustedArea = Object.assign({}, baseArea);

    if (dataRatio > canvasRatio) {
        // Data is wider than canvas - reduce height (add padding top/bottom)
        var idealHeight = baseArea.width / dataRatio;
        var heightDiff = baseArea.height - idealHeight;
        adjustedArea.height = idealHeight;
        adjustedArea.y = baseArea.y + heightDiff / 2;
        // Update margins for axes positioning
        adjustedArea.margins = Object.assign({}, baseArea.margins, {
            top: baseArea.margins.top + heightDiff / 2,
            bottom: baseArea.margins.bottom + heightDiff / 2
        });
    } else if (dataRatio < canvasRatio) {
        // Data is taller than canvas - reduce width (add padding left/right)
        var idealWidth = baseArea.height * dataRatio;
        var widthDiff = baseArea.width - idealWidth;
        adjustedArea.width = idealWidth;
        adjustedArea.x = baseArea.x + widthDiff / 2;
        // Update margins for axes positioning
        adjustedArea.margins = Object.assign({}, baseArea.margins, {
            left: baseArea.margins.left + widthDiff / 2,
            right: baseArea.margins.right + widthDiff / 2
        });
    }

    return adjustedArea;
}

/**
 * Draw contours on a canvas context
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 * @param {Object} style.axes - Axes configuration (when provided, axes will be shown)
 * @param {string} style.axes.x.title - X axis title
 * @param {string} style.axes.y.title - Y axis title
 * @param {string} style.axes.x.color - X axis color
 * @param {string} style.axes.y.color - Y axis color
 * @param {boolean} style.showGrid - Show grid lines (default: true when axes is provided)
 * @param {string} style.gridColor - Grid line color (default: '#e0e0e0')
 * @param {number} style.gridWidth - Grid line width (default: 1)
 * @param {Object} style.interaction - Interaction configuration (optional, enables interactive mode when provided)
 * @param {boolean} style.interaction.zoom - Enable zoom (default: true)
 * @param {boolean} style.interaction.pan - Enable pan (default: true)
 * @param {boolean} style.interaction.dblclickReset - Enable double-click reset (default: true)
 * @param {boolean} style.interaction.boxZoom - Enable box zoom (default: false)
 * @param {number} style.interaction.minZoom - Minimum zoom level (default: 0.1)
 * @param {number} style.interaction.maxZoom - Maximum zoom level (default: 10)
 * @param {Function} style.interaction.onZoom - Zoom callback
 * @param {Function} style.interaction.onPan - Pan callback
 * @param {Function} style.interaction.onReset - Reset callback
 * @returns {Object|null} Interactive controller if interaction is enabled, null otherwise
 */
function drawContours(ctx, contourResult, style) {
    style = style || {};

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var coloring = style.coloring || 'lines';
    var showLines = style.showLines !== false;
    var smoothing = style.smoothing || 0;
    var useClipMask = style.useClipMask !== false;
    var hasAxes = style.axes !== undefined && style.axes !== null;

    // Extract data coordinates from contourResult for scalePoint function
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    if (pathInfo) {
        style = Object.assign({
            x: pathInfo.x,
            y: pathInfo.y,
            z: pathInfo.z
        }, style);
    }

    // Check if interaction is enabled
    var interactionConfig = style.interaction;
    if (interactionConfig) {
        // Use interactive renderer
        return createInteractiveRenderer(ctx.canvas, contourResult, style, interactionConfig);
    }

    // Static rendering mode
    renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo);

    return null;
}

/**
 * Static rendering
 * @private
 */
function renderStatic(ctx, contourResult, style, width, height, coloring, showLines, useClipMask, hasAxes, pathInfo) {
    var padding = style.padding || 50;

    // Calculate base drawing area
    var baseDrawingArea = {
        x: padding,
        y: padding,
        width: width - 2 * padding,
        height: height - 2 * padding,
        margins: {
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
        }
    };

    // Get full data range from contour result
    var fullRange = getFullRange(pathInfo);

    // Apply aspect ratio adjustment if needed
    var aspectRatio = style.aspectRatio || 'auto';
    var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    if (style.backgroundColor) {
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(0, 0, width, height);
    }

    // Layer 1: Grid (if axes configured and showGrid is true)
    var showGrid = style.showGrid !== false && hasAxes;
    if (showGrid) {
        renderGridLayer(ctx, drawingArea, fullRange, style);
    }

    // Layer 2: Contour content
    renderContourLayer(ctx, drawingArea, fullRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo);

    // Layer 3: Axes (if configured)
    if (hasAxes) {
        renderAxesLayer(ctx, drawingArea, fullRange, fullRange, style);
    }

    // Draw colorbar (if enabled)
    var showColorbar = style.showColorbar !== false &&
                       (style.colorbar === undefined || style.colorbar === true || style.colorbar.show !== false);
    if (showColorbar && (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap')) {
        drawColorbar(ctx, contourResult, style);
    }
}

/**
 * Create interactive renderer
 * @private
 */
function createInteractiveRenderer(canvas, contourResult, style, interactionConfig) {
    var width = style.width || canvas.width;
    var height = style.height || canvas.height;
    var padding = style.padding || 50;

    // Calculate base drawing area
    var baseDrawingArea = {
        x: padding,
        y: padding,
        width: width - 2 * padding,
        height: height - 2 * padding,
        margins: {
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
        }
    };

    // Get full data range from contour result
    var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
    var fullRange = getFullRange(pathInfo);

    // Apply aspect ratio adjustment if needed
    var aspectRatio = style.aspectRatio || 'auto';
    var drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, aspectRatio);

    // Create view state manager
    var viewManager = viewState.createViewManager(fullRange, {
        minZoom: interactionConfig.minZoom || 0.1,
        maxZoom: interactionConfig.maxZoom || 10
    });

    // Store state
    var currentStyle = Object.assign({}, style);
    var hasAxes = currentStyle.axes !== undefined && currentStyle.axes !== null;
    var currentAspectRatio = aspectRatio;

    // Store state for overlay access
    var _overlay = null;
    var _fullRange = fullRange;
    var _drawingArea = drawingArea;

    // Store original data for dynamic updates
    var _gridData = {
        z: style.z,
        x: style.x,
        y: style.y
    };
    var _computeOptions = {
        autocontour: style.autocontour !== false,
        ncontours: style.ncontours || 15,
        smoothing: style.smoothing !== undefined ? style.smoothing : 0.5,
        start: style.start,
        end: style.end,
        size: style.size,
        valueColorMap: style.valueColorMap
    };

    /**
     * Render all layers
     */
    function render() {
        var ctx = canvas.getContext('2d');
        var visibleRange = viewManager.getState();

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background
        if (currentStyle.backgroundColor) {
            ctx.fillStyle = currentStyle.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        // Layer 1: Grid (if showGrid is true)
        // Grid can be shown independently of axes
        var showGrid = currentStyle.showGrid === true;
        if (showGrid) {
            renderGridLayer(ctx, drawingArea, visibleRange, currentStyle);
        }

        // Layer 2: Contour content
        renderContourLayer(ctx, drawingArea, visibleRange, fullRange, contourResult, currentStyle, currentStyle.useClipMask !== false, currentStyle.coloring || 'lines', currentStyle.showLines !== false, pathInfo);

        // Layer 3: Axes (if configured)
        if (hasAxes) {
            renderAxesLayer(ctx, drawingArea, visibleRange, fullRange, currentStyle);
        }

        // Draw colorbar
        var showColorbarInteractive = currentStyle.showColorbar !== false &&
            (currentStyle.colorbar === undefined || currentStyle.colorbar === true || currentStyle.colorbar.show !== false);
        if (showColorbarInteractive &&
            (currentStyle.coloring === 'fill' || currentStyle.coloring === 'fill+lines' || currentStyle.coloring === 'heatmap')) {
            drawColorbar(ctx, contourResult, currentStyle);
        }

        // Layer 4: Overlay
        if (_overlay) {
            _overlay.render(ctx);
        }
    }

    // Initial render
    render();

    // Create interaction manager
    var interactionConfig = Object.assign({}, interactionConfig, {
        contourResult: contourResult  // Pass contour result for hover detection
    });
    var interaction = createInteractionManagerInternal(canvas, drawingArea, viewManager, render, interactionConfig);
    return {
        getViewState: function() {
            return viewManager.getState();
        },

        setViewRange: function(xMin, xMax, yMin, yMax) {
            viewManager.setRange(xMin, xMax, yMin, yMax);
            render();
        },

        resetView: function() {
            viewManager.reset();
            render();
            if (interactionConfig.onReset) {
                interactionConfig.onReset();
            }
        },

        updateStyle: function(newStyle) {
            currentStyle = Object.assign(currentStyle, newStyle);
            hasAxes = currentStyle.axes !== undefined && currentStyle.axes !== null;

            // Recalculate drawing area if aspectRatio changed
            var newAspectRatio = currentStyle.aspectRatio || 'auto';
            if (newAspectRatio !== currentAspectRatio) {
                currentAspectRatio = newAspectRatio;
                drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            }

            render();
        },

        resize: function(newWidth, newHeight) {
            width = newWidth;
            height = newHeight;
            canvas.width = width;
            canvas.height = height;

            // Recalculate base drawing area
            baseDrawingArea = {
                x: padding,
                y: padding,
                width: width - 2 * padding,
                height: height - 2 * padding,
                margins: {
                    left: padding,
                    right: padding,
                    top: padding,
                    bottom: padding
                }
            };

            // Recalculate adjusted drawing area
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);

            render();
        },

        getContourResult: function() {
            return contourResult;
        },

        getViewManager: function() {
            return viewManager;
        },

        getDrawingArea: function() {
            return drawingArea;
        },

        /**
         * Get overlay manager for drawing overlay elements
         * @returns {Object} Overlay system instance
         */
        getOverlay: function() {
            if (!_overlay) {
                // Create renderer-like object for the new overlay system
                var rendererLike = {
                    _fullRange: _fullRange,
                    _drawingArea: drawingArea,
                    getViewManager: function() { return viewManager; },
                    refresh: render
                };
                _overlay = createOverlaySystem(rendererLike);
            }
            return _overlay;
        },

        destroy: function() {
            interaction.destroy();
        },

        render: render,

        // ========================================
        // 数据更新 API
        // ========================================

        /**
         * 更新数据（重新计算等值线）
         * @param {Object} newData - 新数据
         * @param {Array} newData.z - Z 值矩阵
         * @param {Array} [newData.x] - X 坐标数组
         * @param {Array} [newData.y] - Y 坐标数组
         */
        updateData: function(newData) {
            if (!newData) return;

            if (newData.z) _gridData.z = newData.z;
            if (newData.x) _gridData.x = newData.x;
            if (newData.y) _gridData.y = newData.y;

            // 重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle 中的数据引用
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;

            // 重新计算绘图区域
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;

            render();
        },

        /**
         * 更新 ColorScale（重新计算等值线，因为 levels 会变化）
         * @param {Array} valueColorMap - 颜色映射数组 [[value, color], ...]
         */
        updateColorScale: function(valueColorMap) {
            if (!Array.isArray(valueColorMap)) return;

            _computeOptions.valueColorMap = valueColorMap;
            currentStyle.valueColorMap = valueColorMap;

            // 重新计算等值线（levels 会根据 valueColorMap 变化）
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];

            render();
        },

        /**
         * 更新 ColorBar
         * @param {Object} config - ColorBar 配置
         * @param {Array} [config.valueColorMap] - 颜色映射数组
         * @param {string} [config.title] - 标题
         * @param {number} [config.thickness] - 厚度
         * @param {string} [config.position] - 位置 ('left' | 'right')
         * @param {number} [config.tickInterval] - 刻度间隔
         */
        updateColorbar: function(config) {
            if (!config) return;

            // 如果提供了新的 valueColorMap，需要重新计算等值线
            if (config.valueColorMap && Array.isArray(config.valueColorMap)) {
                _computeOptions.valueColorMap = config.valueColorMap;
                currentStyle.valueColorMap = config.valueColorMap;
                contourResult = compute.computeContours(_gridData, _computeOptions);
                pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            }

            // 更新 colorbar 配置
            if (!currentStyle.colorbar) {
                currentStyle.colorbar = {};
            }
            Object.assign(currentStyle.colorbar, config);

            render();
        },

        /**
         * 更新等值线参数（重新计算）
         * @param {Object} options - 等值线参数
         * @param {number} [options.smoothing] - 平滑度 0-1
         * @param {boolean} [options.autocontour] - 是否自动计算等值线
         * @param {number} [options.ncontours] - 等值线数量
         * @param {number} [options.start] - 起始值
         * @param {number} [options.end] - 结束值
         * @param {number} [options.size] - 步长
         */
        updateContours: function(options) {
            if (!options) return;

            if (options.smoothing !== undefined) _computeOptions.smoothing = options.smoothing;
            if (options.autocontour !== undefined) _computeOptions.autocontour = options.autocontour;
            if (options.ncontours !== undefined) _computeOptions.ncontours = options.ncontours;
            if (options.start !== undefined) _computeOptions.start = options.start;
            if (options.end !== undefined) _computeOptions.end = options.end;
            if (options.size !== undefined) _computeOptions.size = options.size;

            // 重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle
            currentStyle.smoothing = _computeOptions.smoothing;

            render();
        },

        /**
         * 批量更新（智能合并）
         * @param {Object} config - 配置对象
         * @param {Object} [config.data] - 数据更新
         * @param {Array} [config.colorScale] - 颜色映射
         * @param {Object} [config.contours] - 等值线参数
         * @param {Object} [config.colorbar] - ColorBar 配置
         */
        update: function(config) {
            if (!config) return;

            // 数据更新
            if (config.data) {
                if (config.data.z) _gridData.z = config.data.z;
                if (config.data.x) _gridData.x = config.data.x;
                if (config.data.y) _gridData.y = config.data.y;
            }

            // ColorScale 更新
            if (config.colorScale && Array.isArray(config.colorScale)) {
                _computeOptions.valueColorMap = config.colorScale;
                currentStyle.valueColorMap = config.colorScale;
            }

            // 等值线参数更新
            if (config.contours) {
                var opts = config.contours;
                if (opts.smoothing !== undefined) _computeOptions.smoothing = opts.smoothing;
                if (opts.autocontour !== undefined) _computeOptions.autocontour = opts.autocontour;
                if (opts.ncontours !== undefined) _computeOptions.ncontours = opts.ncontours;
                if (opts.start !== undefined) _computeOptions.start = opts.start;
                if (opts.end !== undefined) _computeOptions.end = opts.end;
                if (opts.size !== undefined) _computeOptions.size = opts.size;
            }

            // 统一重新计算等值线
            contourResult = compute.computeContours(_gridData, _computeOptions);

            // 更新 pathInfo 和 fullRange
            pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
            fullRange = getFullRange(pathInfo);
            _fullRange = fullRange;

            // 更新 currentStyle
            currentStyle.z = _gridData.z;
            currentStyle.x = _gridData.x;
            currentStyle.y = _gridData.y;
            currentStyle.smoothing = _computeOptions.smoothing;

            // ColorBar 更新
            if (config.colorbar) {
                if (!currentStyle.colorbar) {
                    currentStyle.colorbar = {};
                }
                Object.assign(currentStyle.colorbar, config.colorbar);
            }

            // 重新计算绘图区域
            drawingArea = calculateAspectRatioDrawingArea(baseDrawingArea, fullRange, currentAspectRatio);
            _drawingArea = drawingArea;

            render();
        },

        /**
         * 获取当前数据
         * @returns {Object} 数据对象 { z, x, y }
         */
        getData: function() {
            return {
                z: _gridData.z,
                x: _gridData.x,
                y: _gridData.y
            };
        },

        /**
         * 获取当前 ColorScale
         * @returns {Array} valueColorMap
         */
        getColorScale: function() {
            return currentStyle.valueColorMap;
        }
    };
}

/**
 * Get full data range from path info
 * @private
 */
function getFullRange(pathInfo) {
    if (pathInfo) {
        var xData = pathInfo.x || [];
        var yData = pathInfo.y || [];
        return {
            xMin: xData.length > 0 ? Math.min.apply(Math, xData) : 0,
            xMax: xData.length > 0 ? Math.max.apply(Math, xData) : 1,
            yMin: yData.length > 0 ? Math.min.apply(Math, yData) : 0,
            yMax: yData.length > 0 ? Math.max.apply(Math, yData) : 1
        };
    }
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
}

/**
 * Render grid layer
 * @private
 */
function renderGridLayer(ctx, drawArea, visibleRange, style) {
    var gridColor = style.gridColor || '#e0e0e0';
    var gridWidth = style.gridWidth || 1;

    // Calculate grid lines based on visible range
    var xRange = visibleRange.xMax - visibleRange.xMin;
    var yRange = visibleRange.yMax - visibleRange.yMin;

    // Generate tick values for grid lines
    var numXLines = 10;
    var numYLines = 10;

    var xStep = xRange / numXLines;
    var yStep = yRange / numYLines;

    // Round step to nice values
    xStep = Math.pow(10, Math.floor(Math.log10(xStep))) * Math.ceil(xStep / Math.pow(10, Math.floor(Math.log10(xStep))));
    yStep = Math.pow(10, Math.floor(Math.log10(yStep))) * Math.ceil(yStep / Math.pow(10, Math.floor(Math.log10(yStep))));

    // Generate tick values
    var xTicks = [];
    var yTicks = [];

    var xStart = Math.ceil(visibleRange.xMin / xStep) * xStep;
    for (var x = xStart; x <= visibleRange.xMax; x += xStep) {
        xTicks.push(x);
    }

    var yStart = Math.ceil(visibleRange.yMin / yStep) * yStep;
    for (var y = yStart; y <= visibleRange.yMax; y += yStep) {
        yTicks.push(y);
    }

    ctx.save();

    // Draw X grid lines
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = gridWidth;

    for (var i = 0; i < xTicks.length; i++) {
        var dataX = xTicks[i];
        var canvasX = drawArea.x + (dataX - visibleRange.xMin) / xRange * drawArea.width;

        if (canvasX >= drawArea.x && canvasX <= drawArea.x + drawArea.width) {
            ctx.moveTo(canvasX, drawArea.y);
            ctx.lineTo(canvasX, drawArea.y + drawArea.height);
        }
    }
    ctx.stroke();

    // Draw Y grid lines
    ctx.beginPath();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = gridWidth;

    for (var i = 0; i < yTicks.length; i++) {
        var dataY = yTicks[i];
        var canvasY = drawArea.y + drawArea.height - (dataY - visibleRange.yMin) / yRange * drawArea.height;

        if (canvasY >= drawArea.y && canvasY <= drawArea.y + drawArea.height) {
            ctx.moveTo(drawArea.x, canvasY);
            ctx.lineTo(drawArea.x + drawArea.width, canvasY);
        }
    }
    ctx.stroke();

    ctx.restore();
}

/**
 * Render contour content layer
 * @private
 */
function renderContourLayer(ctx, drawArea, visibleRange, fullRange, contourResult, style, useClipMask, coloring, showLines, pathInfo) {
    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    // Create style with visibleRange for proper coordinate scaling
    // Include drawArea for correct coordinate transformation with aspect ratio
    var renderStyle = Object.assign({}, style, {
        visibleRange: visibleRange,
        fullRange: fullRange,
        drawArea: drawArea,  // Pass drawArea for scalePoint to use
        width: drawArea.width + 2 * drawArea.margins.left,
        height: drawArea.height + 2 * drawArea.margins.top,
        padding: drawArea.x,  // Keep for backward compatibility
        z: style.z || (pathInfo ? pathInfo.z : null),
        x: style.x || (pathInfo ? pathInfo.x : null),
        y: style.y || (pathInfo ? pathInfo.y : null),
        connectgaps: connectGaps  // Pass connectgaps to drawFilledPaths for correct background color
    });

    ctx.save();

    // Clip to drawing area
    ctx.beginPath();
    ctx.rect(drawArea.x, drawArea.y, drawArea.width, drawArea.height);
    ctx.clip();

    // Apply clip path for null handling (if needed)
    // Use visibleRange for coordinate conversion to match contour rendering
    // This ensures clip mask stays consistent with contours during zoom/pan
    if (needsClip && useClipMask) {
        // Pass real data coordinates for proper coordinate transformation
        // Include anti-aliasing options from style
        var clipPathData = nullHandling.generateClipPath(contourResult, {
            useDataCoordinates: true,
            dataX: pathInfo ? pathInfo.x : null,
            dataY: pathInfo ? pathInfo.y : null,
            // Anti-aliasing options
            smoothingMethod: style.smoothingMethod,
            upsampleScale: style.upsampleScale,
            clipLevel: style.clipLevel,
            clipSmoothing: style.clipSmoothing,
            simplifyTolerance: style.simplifyTolerance
        });
        if (clipPathData) {
            applyCanvasClipPathFromData(ctx, clipPathData, drawArea, visibleRange);
        }
    }

    // Draw heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap' && pathInfo) {
        drawHeatmap.drawInterpolatedHeatmap(ctx, {
            z: pathInfo.z,
            x: pathInfo.x,
            y: pathInfo.y
        }, renderStyle);
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'fill+lines' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, renderStyle);
    }

    // Draw contour lines
    var shouldDrawLines = (coloring === 'lines') || (coloring === 'fill+lines');
    if (shouldDrawLines) {
        drawPaths.drawStrokePaths(ctx, contourResult, renderStyle);
    }

    // Draw null regions as fallback
    if (needsClip && !useClipMask) {
        drawNulls(ctx, contourResult, renderStyle);
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, renderStyle);
    }

    ctx.restore();
}

/**
 * Apply clip path from data coordinates
 * Uses regular clip (nonzero rule) to show the data region defined by the path
 * @private
 */
function applyCanvasClipPathFromData(ctx, pathData, drawArea, fullRange) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    var xRange = fullRange.xMax - fullRange.xMin;
    var yRange = fullRange.yMax - fullRange.yMin;

    ctx.beginPath();

    function dataToCanvas(dataX, dataY) {
        var cx = drawArea.x + (dataX - fullRange.xMin) / xRange * drawArea.width;
        var cy = drawArea.y + drawArea.height - (dataY - fullRange.yMin) / yRange * drawArea.height;
        return [cx, cy];
    }

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        switch (type) {
            case 'M':
                var pt = dataToCanvas(args[0], args[1]);
                ctx.moveTo(pt[0], pt[1]);
                currentX = args[0];
                currentY = args[1];
                startX = args[0];
                startY = args[1];
                break;
            case 'L':
                var pt = dataToCanvas(args[0], args[1]);
                ctx.lineTo(pt[0], pt[1]);
                currentX = args[0];
                currentY = args[1];
                break;
            case 'Z':
            case 'z':
                ctx.closePath();
                currentX = startX;
                currentY = startY;
                break;
            default:
                if (args.length >= 2) {
                    var pt = dataToCanvas(args[args.length - 2], args[args.length - 1]);
                    ctx.lineTo(pt[0], pt[1]);
                }
                break;
        }
    }

    // Use regular clip (nonzero rule) - the path defines the visible data region
    ctx.clip();
}

/**
 * Render axes layer
 * @private
 */
function renderAxesLayer(ctx, drawArea, visibleRange, fullRange, style) {
    var axesConfig = style.axes || {};
    var xOptions = axesConfig.x || {};
    var yOptions = axesConfig.y || {};

    var axisSetup = axes.setupAxes({
        width: drawArea.width + 2 * drawArea.x,
        height: drawArea.height + 2 * drawArea.y,
        margins: drawArea.margins,
        visibleRange: visibleRange,
        fullRange: fullRange,
        x: xOptions,
        y: yOptions
    });

    axesRenderer.drawAxesFromSetup(ctx, axisSetup);
}

/**
 * Create internal interaction manager
 * @private
 */
function createInteractionManagerInternal(canvas, drawingArea, viewManager, render, config) {
    config = config || {};

    var isDragging = false;
    var isBoxZooming = false;
    var lastX = 0;
    var lastY = 0;
    var boxStartX = 0;
    var boxStartY = 0;

    var zoomEnabled = config.zoom !== false;
    var panEnabled = config.pan !== false;
    var dblclickReset = config.dblclickReset !== false;
    var boxZoomEnabled = config.boxZoom === true;
    var zoomSensitivity = 0.001;

    // Hover configuration
    var hoverEnabled = config.hover === true;
    var hoverHitRadius = config.hoverHitRadius || 8;
    var contourResult = config.contourResult;
    var hoverFormatter = config.hoverFormatter;  // Custom formatter function
    var tooltipElement = null;

    var boundHandlers = {};

    function getMousePos(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function isInDrawingArea(pos) {
        return pos.x >= drawingArea.x &&
               pos.x <= drawingArea.x + drawingArea.width &&
               pos.y >= drawingArea.y &&
               pos.y <= drawingArea.y + drawingArea.height;
    }

    function handleWheel(e) {
        if (!zoomEnabled) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        var dataPos = viewManager.pixelToData(pos.x, pos.y, drawingArea);

        var delta = -e.deltaY;
        var factor = 1 + delta * zoomSensitivity;
        factor = Math.max(0.5, Math.min(2, factor));

        viewManager.zoomAt(factor, dataPos.x, dataPos.y, drawingArea);
        render();

        if (config.onZoom) {
            config.onZoom(viewManager.getState());
        }
    }

    function handleMouseDown(e) {
        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        if (e.button === 0) {
            if (e.shiftKey && boxZoomEnabled) {
                isBoxZooming = true;
                boxStartX = pos.x;
                boxStartY = pos.y;
            } else if (panEnabled) {
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
                canvas.style.cursor = 'grabbing';
            }
        }
    }

    function handleMouseMove(e) {
        var pos = getMousePos(e);

        if (isDragging) {
            e.preventDefault();

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            render();

            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        } else if (isBoxZooming) {
            // Box zoom visual feedback could be added here
        } else if (isInDrawingArea(pos)) {
            canvas.style.cursor = 'grab';

            // Hover detection for contour lines
            if (hoverEnabled && contourResult) {
                var hoverData = detectContourAtPosition(pos.x, pos.y);
                if (hoverData) {
                    showTooltip(pos.x, pos.y, hoverData);
                } else {
                    hideTooltip();
                }
            }
        } else {
            canvas.style.cursor = 'default';
            hideTooltip();
        }
    }

    /**
     * Detect contour line at given pixel position
     */
    function detectContourAtPosition(px, py) {
        if (!contourResult || !contourResult.paths) return null;

        var paths = contourResult.paths;
        var pathInfo = contourResult.pathinfo && contourResult.pathinfo[0];
        if (!pathInfo) return null;

        // Get visible range
        var state = viewManager.getState();
        var xMin = state.xMin;
        var xMax = state.xMax;
        var yMin = state.yMin;
        var yMax = state.yMax;
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;

        // Check each contour level
        for (var i = 0; i < paths.length; i++) {
            var pathData = paths[i];
            var level = pathData.level;

            // Check all paths (both closed and edge paths)
            var allPaths = (pathData.paths || []).concat(pathData.edgepaths || []);

            for (var j = 0; j < allPaths.length; j++) {
                var path = allPaths[j];
                if (!path || path.length < 2) continue;

                // Check each line segment
                for (var k = 0; k < path.length - 1; k++) {
                    var p1 = path[k];
                    var p2 = path[k + 1];

                    // Convert data coordinates to pixel coordinates
                    var px1 = drawingArea.x + (p1[0] - xMin) / xRange * drawingArea.width;
                    var py1 = drawingArea.y + drawingArea.height - (p1[1] - yMin) / yRange * drawingArea.height;
                    var px2 = drawingArea.x + (p2[0] - xMin) / xRange * drawingArea.width;
                    var py2 = drawingArea.y + drawingArea.height - (p2[1] - yMin) / yRange * drawingArea.height;

                    // Calculate distance from point to line segment
                    var dist = pointToSegmentDistance(px, py, px1, py1, px2, py2);

                    if (dist <= hoverHitRadius) {
                        // Convert pixel back to data coordinates for tooltip
                        var dataX = xMin + (px - drawingArea.x) / drawingArea.width * xRange;
                        var dataY = yMin + (1 - (py - drawingArea.y) / drawingArea.height) * yRange;

                        return {
                            level: level,
                            x: dataX,
                            y: dataY,
                            distance: dist
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Calculate distance from point to line segment
     */
    function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1;
        var dy = y2 - y1;
        var lengthSq = dx * dx + dy * dy;

        if (lengthSq === 0) {
            // Segment is a point
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        // Calculate projection of point onto line
        var t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        // Calculate closest point on segment
        var projX = x1 + t * dx;
        var projY = y1 + t * dy;

        // Return distance
        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    /**
     * Show tooltip at position
     */
    function showTooltip(px, py, hoverData) {
        if (!tooltipElement) {
            tooltipElement = document.createElement('div');
            tooltipElement.className = 'contour-hover-tooltip';
            tooltipElement.style.cssText = [
                'position: absolute',
                'pointer-events: none',
                'display: none',
                'background: rgba(255, 255, 255, 0.95)',
                'border: 1px solid #333',
                'border-radius: 4px',
                'padding: 8px 12px',
                'font-size: 12px',
                'font-family: Arial, sans-serif',
                'color: #333',
                'white-space: nowrap',
                'box-shadow: 0 2px 8px rgba(0,0,0,0.2)',
                'z-index: 10000'
            ].join(';');
            document.body.appendChild(tooltipElement);
        }

        // Format tooltip content - use custom formatter or default
        var content;
        if (hoverFormatter && typeof hoverFormatter === 'function') {
            content = hoverFormatter(hoverData);
        } else {
            // Default formatter
            content = '<strong>值:</strong> ' + hoverData.level.toFixed(2);
            if (hoverData.x !== undefined && hoverData.y !== undefined) {
                content += '<br><strong>X:</strong> ' + hoverData.x.toFixed(4);
                content += '<br><strong>Y:</strong> ' + hoverData.y.toFixed(4);
            }
        }

        tooltipElement.innerHTML = content;
        tooltipElement.style.display = 'block';

        // Position tooltip near cursor
        var canvasRect = canvas.getBoundingClientRect();
        var tooltipX = canvasRect.left + px + 15;
        var tooltipY = canvasRect.top + py - 40;

        // Keep tooltip within viewport
        if (tooltipX + 150 > window.innerWidth) {
            tooltipX = canvasRect.left + px - 160;
        }
        if (tooltipY < 5) {
            tooltipY = canvasRect.top + py + 20;
        }

        tooltipElement.style.left = tooltipX + 'px';
        tooltipElement.style.top = tooltipY + 'px';
    }

    /**
     * Hide tooltip
     */
    function hideTooltip() {
        if (tooltipElement) {
            tooltipElement.style.display = 'none';
        }
    }

    function handleMouseUp(e) {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }

        if (isBoxZooming) {
            isBoxZooming = false;

            var pos = getMousePos(e);

            var x1 = Math.min(boxStartX, pos.x);
            var x2 = Math.max(boxStartX, pos.x);
            var y1 = Math.min(boxStartY, pos.y);
            var y2 = Math.max(boxStartY, pos.y);

            if (x2 - x1 > 10 && y2 - y1 > 10) {
                var dataStart = viewManager.pixelToData(x1, y2, drawingArea);
                var dataEnd = viewManager.pixelToData(x2, y1, drawingArea);

                viewManager.setRange(dataStart.x, dataEnd.x, dataStart.y, dataEnd.y);
                render();

                if (config.onZoom) {
                    config.onZoom(viewManager.getState());
                }
            }
        }
    }

    function handleDblClick(e) {
        if (!dblclickReset) return;

        var pos = getMousePos(e);
        if (!isInDrawingArea(pos)) return;

        e.preventDefault();

        viewManager.reset();
        render();

        if (config.onReset) {
            config.onReset();
        }
    }

    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            var touch = e.touches[0];
            var pos = getMousePos(touch);

            if (isInDrawingArea(pos)) {
                isDragging = true;
                lastX = pos.x;
                lastY = pos.y;
            }
        }
    }

    function handleTouchMove(e) {
        if (e.touches.length === 1 && isDragging) {
            e.preventDefault();

            var touch = e.touches[0];
            var pos = getMousePos(touch);

            var dx = pos.x - lastX;
            var dy = pos.y - lastY;

            viewManager.pan(dx, dy, drawingArea);

            lastX = pos.x;
            lastY = pos.y;

            render();

            if (config.onPan) {
                config.onPan(viewManager.getState());
            }
        }
    }

    function handleTouchEnd(e) {
        isDragging = false;
    }

    function bindEvents() {
        boundHandlers.wheel = handleWheel;
        boundHandlers.mousedown = handleMouseDown;
        boundHandlers.mousemove = handleMouseMove;
        boundHandlers.mouseup = handleMouseUp;
        boundHandlers.mouseleave = handleMouseUp;
        boundHandlers.dblclick = handleDblClick;
        boundHandlers.touchstart = handleTouchStart;
        boundHandlers.touchmove = handleTouchMove;
        boundHandlers.touchend = handleTouchEnd;

        canvas.addEventListener('wheel', boundHandlers.wheel, { passive: false });
        canvas.addEventListener('mousedown', boundHandlers.mousedown);
        canvas.addEventListener('mousemove', boundHandlers.mousemove);
        canvas.addEventListener('mouseup', boundHandlers.mouseup);
        canvas.addEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.addEventListener('dblclick', boundHandlers.dblclick);
        canvas.addEventListener('touchstart', boundHandlers.touchstart, { passive: false });
        canvas.addEventListener('touchmove', boundHandlers.touchmove, { passive: false });
        canvas.addEventListener('touchend', boundHandlers.touchend);
    }

    function unbindEvents() {
        canvas.removeEventListener('wheel', boundHandlers.wheel);
        canvas.removeEventListener('mousedown', boundHandlers.mousedown);
        canvas.removeEventListener('mousemove', boundHandlers.mousemove);
        canvas.removeEventListener('mouseup', boundHandlers.mouseup);
        canvas.removeEventListener('mouseleave', boundHandlers.mouseleave);
        canvas.removeEventListener('dblclick', boundHandlers.dblclick);
        canvas.removeEventListener('touchstart', boundHandlers.touchstart);
        canvas.removeEventListener('touchmove', boundHandlers.touchmove);
        canvas.removeEventListener('touchend', boundHandlers.touchend);
    }

    function destroy() {
        unbindEvents();
        // Clean up tooltip
        if (tooltipElement) {
            tooltipElement.parentNode.removeChild(tooltipElement);
            tooltipElement = null;
        }
    }

    bindEvents();

    return {
        destroy: destroy
    };
}

/**
 * Apply SVG path data as a clipping region to canvas context (for static mode)
 * @private
 */
function applyCanvasClip(ctx, pathData, width, height) {
    ctx.save();

    // Parse SVG path data and create canvas path
    parseSVGPathToCanvas(ctx, pathData);

    // Apply clipping
    ctx.clip();
}

/**
 * Parse SVG path data and draw it on canvas
 * @private
 */
function parseSVGPathToCanvas(ctx, pathData) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    ctx.beginPath();

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        switch (type) {
            case 'M':
                ctx.moveTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                startX = args[0];
                startY = args[1];
                break;
            case 'm':
                ctx.moveTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                break;
            case 'L':
                ctx.lineTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                break;
            case 'l':
                ctx.lineTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                break;
            case 'H':
                ctx.lineTo(args[0], currentY);
                currentX = args[0];
                break;
            case 'h':
                ctx.lineTo(currentX + args[0], currentY);
                currentX += args[0];
                break;
            case 'V':
                ctx.lineTo(currentX, args[0]);
                currentY = args[0];
                break;
            case 'v':
                ctx.lineTo(currentX, currentY + args[0]);
                currentY += args[0];
                break;
            case 'Z':
            case 'z':
                ctx.closePath();
                currentX = startX;
                currentY = startY;
                break;
            default:
                if (args.length >= 2) {
                    ctx.lineTo(args[args.length - 2], args[args.length - 1]);
                }
                break;
        }
    }
}

    // ============================================
    // CLOSE BOUNDARIES
    // ============================================
    /**
 * Close boundary paths for contour filling
 * Adapted from Plotly.js src/traces/contour/close_boundaries.js
 *
 * This function sets prefixBoundary flag on each pathinfo item
 * to indicate whether the perimeter boundary should be prepended
 * to the fill path.
 *
 * @param {Array} pathinfo - Array of path info objects from marching squares
 * @param {Object} contours - Contour configuration
 */
function closeBoundaries(pathinfo, contours) {
    var pi0 = pathinfo[0];
    var z = pi0.z;
    var i;

    switch(contours.type || contours.coloring) {
        case 'levels':
        case 'fill':
            // Find the minimum non-null value on the data boundary
            // This is needed for proper prefixBoundary calculation when data has nulls
            var na = pi0.x.length;
            var nb = pi0.y.length;
            var boundaryMin = Infinity;

            // Check all boundary cells for minimum non-null value
            for(i = 0; i < nb; i++) {
                if(z[i][0] !== null && z[i][0] < boundaryMin) boundaryMin = z[i][0];
                if(z[i][na - 1] !== null && z[i][na - 1] < boundaryMin) boundaryMin = z[i][na - 1];
            }
            for(i = 1; i < na - 1; i++) {
                if(z[0][i] !== null && z[0][i] < boundaryMin) boundaryMin = z[0][i];
                if(z[nb - 1][i] !== null && z[nb - 1][i] < boundaryMin) boundaryMin = z[nb - 1][i];
            }

            // Fallback to z[0][0] and z[0][1] if no valid boundary values found
            if(boundaryMin === Infinity) {
                boundaryMin = Math.min(z[0][0] || Infinity, z[0][1] || Infinity);
            }

            for(i = 0; i < pathinfo.length; i++) {
                var pi = pathinfo[i];
                pi.prefixBoundary = !pi.edgepaths.length &&
                    (boundaryMin > pi.level || pi.starts.length && boundaryMin === pi.level);
            }
            break;
        case 'constraint':
            // after convertToConstraints, pathinfo has length=0
            pi0.prefixBoundary = false;

            // joinAllPaths does enough already when edgepaths are present
            if(pi0.edgepaths.length) return;

            var na = pi0.x.length;
            var nb = pi0.y.length;
            var boundaryMax = -Infinity;
            var boundaryMin = Infinity;

            for(i = 0; i < nb; i++) {
                boundaryMin = Math.min(boundaryMin, z[i][0]);
                boundaryMin = Math.min(boundaryMin, z[i][na - 1]);
                boundaryMax = Math.max(boundaryMax, z[i][0]);
                boundaryMax = Math.max(boundaryMax, z[i][na - 1]);
            }
            for(i = 1; i < na - 1; i++) {
                boundaryMin = Math.min(boundaryMin, z[0][i]);
                boundaryMin = Math.min(boundaryMin, z[nb - 1][i]);
                boundaryMax = Math.max(boundaryMax, z[0][i]);
                boundaryMax = Math.max(boundaryMax, z[nb - 1][i]);
            }

            var contoursValue = contours.value;
            var v1, v2;

            switch(contours._operation) {
                case '>':
                    if(contoursValue > boundaryMax) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '<':
                    if(contoursValue < boundaryMin ||
                        (pi0.starts.length && contoursValue === boundaryMin)) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '[]':
                    v1 = Math.min(contoursValue[0], contoursValue[1]);
                    v2 = Math.max(contoursValue[0], contoursValue[1]);
                    if(v2 < boundaryMin || v1 > boundaryMax ||
                        (pi0.starts.length && v2 === boundaryMin)) {
                        pi0.prefixBoundary = true;
                    }
                    break;
                case '][':
                    v1 = Math.min(contoursValue[0], contoursValue[1]);
                    v2 = Math.max(contoursValue[0], contoursValue[1]);
                    if(v1 < boundaryMin && v2 > boundaryMax) {
                        pi0.prefixBoundary = true;
                    }
                    break;
            }
            break;
    }
}

    // ============================================
    // COMPUTE (with null handling)
    // ============================================
    /**
 * Contour computation module
 * Standalone implementation - no external dependencies
 */

var levels = { setContours: setContours };
var marchingSquares = { makeCrossings: makeCrossings };
var pathFinding = { findAllPaths: findAllPaths };
var nullHandling = { isValidValue: isValidValue, normalizeNullValues: normalizeNullValues, generateNullMask: generateNullMask };


/**
 * Compute contours from a 2D grid of values
 *
 * @param {Object|Array} grid - Input data:
 *   - Object with z (2D array), x, y (optional 1D arrays)
 *   - Or directly a 2D array (z values), x and y will be auto-generated as [0, 1, 2, ...]
 * @param {Object} options - Contour options (thresholds, autocontour, start, end, size, ncontours, smoothing)
 * @returns {Object} Contour result with levels, paths, pathinfo, nullMask, nullCount, validCount
 */
function computeContours(grid, options) {
    options = options || {};

    // Support both direct z array and {z, x, y} object format
    var z, x, y;
    if (Array.isArray(grid)) {
        // Direct z array passed - auto-generate x and y coordinates
        z = grid;
        var m = z.length;
        var n = z[0] ? z[0].length : 0;
        x = createIndexArray(n);
        y = createIndexArray(m);
    } else if (grid && grid.z && Array.isArray(grid.z)) {
        // Object format with z property
        z = grid.z;
        var m = z.length;
        var n = z[0] ? z[0].length : 0;
        x = grid.x || createIndexArray(n);
        y = grid.y || createIndexArray(m);
    } else {
        throw new Error('Invalid grid: must be a 2D array or an object with z property as 2D array');
    }

    // Validate grid dimensions
    if (m < 2 || n < 2) {
        throw new Error('Invalid grid: must have at least 2x2 data points');
    }

    // Normalize null values and create coordinate arrays
    var normalization = nullHandling.normalizeNullValues(z);
    var cleanedZ = normalization.cleanedGrid;
    var nullMask = normalization.nullMask;

    // Interpolate to fill in null values (like plotly.js does)
    // IMPORTANT: In plotly.js, contours ALWAYS interpolate, regardless of connectgaps setting
    // The connectgaps option only controls whether to MASK the interpolated regions in rendering
    var connectGaps = options.connectgaps !== undefined ? options.connectgaps : true;

    // Always interpolate for contours (matching plotly.js behavior)
    var emptyPoints = findEmpties(cleanedZ);
    if (emptyPoints.length > 0) {
        cleanedZ = interp2d(cleanedZ, emptyPoints);
    }

    // Compute contour levels
    var contourLevels = levels.setContours(options, cleanedZ);

    if (contourLevels.length === 0) {
        return { levels: [], paths: [] };
    }

    // Limit to maximum contours
    if (contourLevels.length > 1000) {
        console.warn('Too many contours (' + contourLevels.length + '), clipping at 1000');
        contourLevels = contourLevels.slice(0, 1000);
    }

    // Create pathinfo array for all levels
    var pathinfo = contourLevels.map(function(level) {
        return {
            level: level,
            crossings: {},
            starts: [],
            edgepaths: [],
            paths: [],
            z: cleanedZ,
            x: x,
            y: y,
            nullMask: nullMask,  // Always include nullMask for renderer reference
            smoothing: options.smoothing || 0
        };
    });

    // Run marching squares and find all paths
    marchingSquares.makeCrossings(pathinfo);

    // Calculate tolerance based on data range
    // Use relative tolerance for better handling of real-world coordinates
    // For very small data ranges (e.g., GPS coordinates), use a small fraction of the range
    // For index-based data, use a reasonable absolute tolerance
    var xRange = x.length > 1 ? (x[x.length - 1] - x[0]) : 1;
    var yRange = y.length > 1 ? (y[y.length - 1] - y[0]) : 1;

    // Use 0.1% of range as tolerance, with a very small minimum to handle edge cases
    // The minimum is set to a tiny value (1e-10) to avoid issues with near-zero ranges
    // while still allowing very small data ranges to work correctly
    var xTol = Math.max(1e-10, xRange * 0.001);
    var yTol = Math.max(1e-10, yRange * 0.001);

    pathFinding.findAllPaths(pathinfo, xTol, yTol);

    // Close boundaries for proper fill rendering
    var contourOptions = options.contours || {};
    if (!contourOptions.type && !contourOptions.coloring) {
        contourOptions.coloring = 'fill';
    }
    closeBoundaries(pathinfo, contourOptions);

    // Build result object
    // Always include nullMask so renderer can decide whether to mask based on connectgaps
    return {
        levels: contourLevels,
        paths: pathinfo.map(function(pi) {
            return {
                level: pi.level,
                edgepaths: pi.edgepaths,
                paths: pi.paths,
                prefixBoundary: pi.prefixBoundary,
                smoothing: pi.smoothing
            };
        }),
        pathinfo: pathinfo,
        nullMask: nullMask,  // Always include nullMask for renderer to use
        nullCount: normalization.nullCount,
        validCount: normalization.validCount,
        connectgaps: connectGaps  // Include connectgaps flag for renderer reference
    };
}

/**
 * Scale paths from grid index space to data space
 */
function scalePathsToData(result, x, y) {
    var n = x.length;
    var m = y.length;

    function scalePointToData(pt) {
        var ix = Math.max(0, Math.min(n - 1, Math.round(pt[0])));
        var iy = Math.max(0, Math.min(m - 1, Math.round(pt[1])));
        return [x[ix], y[iy]];
    }

    result.paths.forEach(function(pathInfo) {
        pathInfo.edgepaths = pathInfo.edgepaths.map(function(path) {
            return path.map(scalePointToData);
        });
        pathInfo.paths = pathInfo.paths.map(function(path) {
            return path.map(scalePointToData);
        });
    });

    return result;
}

/**
 * Create index array [0, 1, 2, ..., n-1]
 */
function createIndexArray(n) {
    var arr = [];
    for (var i = 0; i < n; i++) {
        arr.push(i);
    }
    return arr;
}

    // ============================================
    // SIMPLIFIED RENDERING API
    // ============================================
    /**
 * Simplified rendering API for contour-core
 * Provides easy-to-use functions similar to Plotly's API
 */

var compute = { computeContours: computeContours, scalePathsToData: scalePathsToData };

// Preset color scales
var COLOR_SCALES = {
    Viridis: [
        '#440154', '#482878', '#3e4a89', '#31688e', '#26838f',
        '#1f9d8a', '#35b779', '#6dcd59', '#b4de2c', '#fde725'
    ],
    Plasma: [
        '#0d0887', '#46039f', '#7201a8', '#9c179e', '#bd3786',
        '#d8576b', '#ed7953', '#fb9f3a', '#fdca26', '#f0f921'
    ],
    Hot: [
        '#000000', '#4a0000', '#880000', '#c20000', '#ff0000',
        '#ff4a00', '#ff8800', '#ffc200', '#ffff00', '#ffff80'
    ],
    Jet: [
        '#000080', '#0000ff', '#0080ff', '#00ffff', '#80ff80',
        '#ffff00', '#ff8000', '#ff0000', '#800000', '#000000'
    ],
    Earth: [
        '#2a1c0b', '#5c4033', '#8f6b4e', '#c19a6b', '#e5c99b',
        '#f5e6c8', '#8b4513', '#a0522d', '#cd853f', '#deb887'
    ],
    Electric: [
        '#000004', '#1b0c42', '#4a0c6e', '#781c6d', '#a52c60',
        '#cf4446', '#ed6925', '#fb9b06', '#f7d13d', '#fcffa4'
    ]
};

/**
 * One-step contour rendering - compute and render in one call
 * Similar to Plotly's API: just pass data and options
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} config - Configuration object
 * @param {Array} config.z - 2D array of z values (supports null/undefined/NaN)
 *                           If config is a 2D array directly, it will be treated as z values
 * @param {Array} config.x - Optional x coordinates (auto-generated as [0,1,2,...] if not provided)
 * @param {Array} config.y - Optional y coordinates (auto-generated as [0,1,2,...] if not provided)
 * @param {Object} config.contours - Contour configuration
 * @param {String} config.contours.type - 'fill', 'lines', 'heatmap', or 'none'
 * @param {Boolean} config.contours.showlabels - Show contour labels (future)
 * @param {Number} config.contours.start - Start value for manual contours
 * @param {Number} config.contours.end - End value for manual contours
 * @param {Number} config.contours.size - Step size for manual contours
 * @param {Boolean} config.autocontour - Auto-generate contours (default: true)
 * @param {Number} config.ncontours - Number of auto contours (default: 15)
 * @param {Number} config.smoothing - Smoothing factor 0-1 (default: 0.5)
 * @param {String|Array} config.colorscale - Color scale name or array of colors
 * @param {Array} config.valueColorMap - Segmented color mapping in [[value, color], ...] format
 *                                    Example: [[10, '#ff0000'], [20, '#00ff00'], [30, '#0000ff']]
 *                                    value < 10 uses '#ff0000', 10-20 uses '#00ff00', >= 30 uses '#0000ff'
 * @param {Number} config.zmin - Minimum z value for color mapping
 * @param {Number} config.zmax - Maximum z value for color mapping
 * @param {Boolean} config.reversescale - Reverse the color scale
 * @param {Object} config.colorbar - Colorbar configuration
 * @param {Boolean} config.colorbar.show - Show colorbar (default: true)
 * @param {String} config.colorbar.title - Colorbar title
 * @param {Number} config.colorbar.thickness - Colorbar thickness (default: 20)
 * @param {Number} config.colorbar.len - Colorbar length (0-1, default: 0.8)
 * @param {Object} config.nullRegion - Null region configuration
 * @param {Boolean} config.nullRegion.visible - Show null regions (default: true)
 * @param {String} config.nullRegion.fill - Fill color for null regions (default: '#ffffff')
 * @param {String} config.nullRegion.stroke - Stroke color for null regions (default: '#cccccc')
 * @param {Number} config.nullRegion.strokeWidth - Stroke width (default: 1)
 * @param {Object} config.axes - Axes configuration
 * @param {Object} config.axes.x - X-axis configuration
 * @param {Boolean} config.axes.x.show - Show X-axis (default: true)
 * @param {Array<number>} config.axes.x.range - X-axis range [min, max] (inferred from data if not provided)
 * @param {String} config.axes.x.title - X-axis title
 * @param {String} config.axes.x.tickmode - 'auto' | 'linear' | 'array'
 * @param {Number} config.axes.x.dtick - Tick interval (for linear mode)
 * @param {Number} config.axes.x.nticks - Target number of ticks (for auto mode)
 * @param {Array} config.axes.x.tickvals - Custom tick values (for array mode)
 * @param {Array} config.axes.x.ticktext - Custom tick labels (for array mode)
 * @param {Number} config.axes.x.ticklen - Tick line length (default: 5)
 * @param {String} config.axes.x.tickcolor - Tick line color (default: '#666')
 * @param {Number} config.axes.x.tickwidth - Tick line width (default: 1)
 * @param {String} config.axes.x.side - 'bottom' | 'top' (default: 'bottom')
 * @param {Boolean} config.axes.x.showgrid - Show X-axis grid lines (default: false)
 * @param {String} config.axes.x.gridcolor - Grid line color (default: '#e0e0e0')
 * @param {Number} config.axes.x.gridwidth - Grid line width (default: 1)
 * @param {Object} config.axes.y - Y-axis configuration (similar to x)
 * @param {String} config.axes.y.side - 'left' | 'right' (default: 'left')
 * @param {Number} config.width - Canvas width (default: canvas.width)
 * @param {Number} config.height - Canvas height (default: canvas.height)
 */
function render(canvas, config) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    config = config || {};

    // Support direct z array as config (if config is an array, treat it as z values)
    var grid;
    if (Array.isArray(config)) {
        // Direct z array passed
        grid = config;
    } else {
        // Object format
        grid = {
            z: config.z,
            x: config.x,
            y: config.y
        };
    }

    // Compute options
    var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : undefined,
        end: config.contours ? config.contours.end : undefined,
        size: config.contours ? config.contours.size : undefined,
        smoothing: config.smoothing !== undefined ? config.smoothing : 0.5,
        valueColorMap: config.valueColorMap // Segmented color mapping [[value, color], ...]
    };

    // Compute contours
    var result = compute.computeContours(grid, options);

    // Get canvas dimensions
    var width = config.width || canvas.width || 600;
    var height = config.height || canvas.height || 500;

    // Determine contour type
    var contourType = 'lines';
    if (config.contours && config.contours.type) {
        contourType = config.contours.type;
    }

    // Get color scale (not used if valueColorMap is provided)
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);

    // Build color scale array for renderer (for non-valueColorMap modes)
    var colorScale = buildColorScale(result.levels, colors);

    // For valueColorMap, build a direct mapping format
    var valueColorMap = config.valueColorMap;

    // Rendering style
    var style = {
        width: width,
        height: height,
        x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
        y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
        z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
        coloring: contourType,
        showLines: contourType === 'lines' || contourType === 'heatmap',
        lineWidth: 1.5,
        lineColor: contourType === 'lines' ? '#666' : 'rgba(255,255,255,0.5)',
        colorScale: colorScale,
        valueColorMap: valueColorMap, // Segmented color mapping
        smoothing: options.smoothing
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, config.nullRegion);
    }

    // Draw axes if configured
    if (config.axes) {
        // Set up axes configuration with dimensions
        var axesConfig = config.axes;
        axesConfig.width = width;
        axesConfig.height = height;

        // Pass x and y data for range inference
        if (config.x) {
            axesConfig.xData = config.x;
        }
        if (config.y) {
            axesConfig.yData = config.y;
        }

        // Draw axes (grid lines are drawn automatically if enabled)
        canvasRenderer.drawAxes(ctx, axesConfig);
    }

    // Draw colorbar if requested
    if (config.colorbar && config.colorbar.show !== false && contourType !== 'lines') {
        drawColorbar(ctx, result, colors, config.colorbar, width, height);
    }

    return result;
}

/**
 * Two-step rendering: compute first, then render
 * Useful when you need to reuse computation results
 *
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Rendering options
 * @param {Array} options.valueColorMap - Segmented color mapping [[value, color], ...]
 */
function drawTo(canvas, result, options) {
    if (!canvas) {
        throw new Error('Canvas element is required');
    }

    if (!result || !result.paths) {
        throw new Error('Invalid contour result');
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context from canvas');
    }

    options = options || {};

    var width = options.width || canvas.width || 600;
    var height = options.height || canvas.height || 500;

    // Get color scale (not used if valueColorMap is provided)
    var colors = getColors(
        options.colorscale,
        result.levels,
        options.zmin,
        options.zmax,
        options.reversescale
    );

    var colorScale = buildColorScale(result.levels, colors);
    var valueColorMap = options.valueColorMap;

    var style = {
        width: width,
        height: height,
        coloring: options.coloring || 'fill',
        showLines: options.showLines !== false,
        lineWidth: options.lineWidth || 1.5,
        lineColor: options.lineColor || '#666',
        colorScale: colorScale,
        valueColorMap: valueColorMap,
        smoothing: options.smoothing || 0
    };

    // Draw contours
    canvasRenderer.drawContours(ctx, result, style);

    // Draw null regions if present
    if (result.nullMask && result.nullCount > 0) {
        drawNullRegions(ctx, result, style, options.nullRegion);
    }

    // Draw colorbar if requested
    if (options.showColorbar !== false) {
        drawColorbar(ctx, result, colors, options.colorbar, width, height);
    }
}

/**
 * Get color array from config
 */
function getColors(colorscale, levels, zmin, zmax, reverse) {
    var colors;

    if (Array.isArray(colorscale)) {
        // Custom color array
        colors = colorscale;
    } else if (typeof colorscale === 'string') {
        // Preset color scale
        var name = colorscale.charAt(0).toUpperCase() + colorscale.slice(1).toLowerCase();
        colors = COLOR_SCALES[name] || COLOR_SCALES.Viridis;
    } else {
        // Default to Viridis
        colors = COLOR_SCALES.Viridis;
    }

    if (reverse) {
        colors = colors.slice().reverse();
    }

    return colors;
}

/**
 * Build color scale array for rendering
 */
function buildColorScale(levels, colors) {
    var scale = [];
    var min = levels[0];
    var max = levels[levels.length - 1];

    for (var i = 0; i < levels.length; i++) {
        var t = (levels.length > 1) ? (i / (levels.length - 1)) : 0;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));
        scale.push([levels[i], colors[colorIdx]]);
    }

    return scale;
}

/**
 * Draw null regions on canvas
 */
function drawNullRegions(ctx, result, style, config) {
    if (!result.nullMask) return;

    config = config || {};
    var visible = config.visible !== false;
    if (!visible) return;

    var nullMask = result.nullMask;
    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width;
    var height = style.height;
    var padding = 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    ctx.fillStyle = config.fill || '#ffffff';
    ctx.strokeStyle = config.stroke || '#cccccc';
    ctx.lineWidth = config.strokeWidth || 1;

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding + j * scaleX;
                var y = padding + (m - 1 - i) * scaleY;
                var sizeX = scaleX + 1;
                var sizeY = scaleY + 1;

                ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
        }
    }
}

/**
 * Draw colorbar on canvas
 */
function drawColorbar(ctx, result, colors, config, canvasWidth, canvasHeight) {
    config = config || {};
    var thickness = config.thickness || 20;
    var len = config.len || 0.8;
    var barHeight = canvasHeight * len;
    var x = canvasWidth - thickness - 10;
    var y = (canvasHeight - barHeight) / 2;

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var colorIdx = Math.floor(t * (colors.length - 1));
        colorIdx = Math.max(0, Math.min(colors.length - 1, colorIdx));

        ctx.fillStyle = colors[colorIdx];
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title (future)
    if (config.title) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(config.title, 0, 0);
        ctx.restore();
    }

    // Draw tick labels (simplified)
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var levels = result.levels;
    var tickCount = Math.min(5, levels.length);
    for (var i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }
}

/**
 * Create interactive contour using zrender
 * @param {String|HTMLElement} container - Container selector or element
 * @param {Object|Array} config - Configuration object or direct z array
 * @returns {Object} Interactive contour instance with control methods
 */
function createInteractive(container, config) {
    if (typeof container === 'string') {
        container = document.querySelector(container);
    }

    if (!container) {
        throw new Error('Container element not found');
    }

    // Support direct z array as config
    var isDirectArray = Array.isArray(config);
    if (isDirectArray) {
        config = { z: config };
    } else {
        config = config || {};
    }

    // Get or infer dimensions
    var width = config.width || container.clientWidth || 600;
    var height = config.height || container.clientHeight || 500;

    // Create renderer
    var renderer = zrenderRenderer.createRenderer(container, {
        width: width,
        height: height,
        devicePixelRatio: config.devicePixelRatio
    });

    // Compute contours - support both direct z array and {z, x, y} object
    var grid = {
        z: config.z,
        x: config.x,
        y: config.y
    };

    var options = {
        autocontour: config.autocontour !== false,
        ncontours: config.ncontours || 15,
        start: config.contours ? config.contours.start : undefined,
        end: config.contours ? config.contours.end : undefined,
        size: config.contours ? config.contours.size : undefined,
        smoothing: config.smoothing !== undefined ? config.smoothing : 0.5,
        valueColorMap: config.valueColorMap
    };

    var result = compute.computeContours(grid, options);

    // Build style
    var colors = getColors(config.colorscale, result.levels, config.zmin, config.zmax, config.reversescale);
    var colorScale = buildColorScale(result.levels, colors);

    var style = {
        width: width,
        height: height,
        x: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : config.x,
        y: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : config.y,
        z: result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : config.z,
        padding: 30,  // IMPORTANT: zrender needs padding for coordinate scaling
        coloring: (config.contours && config.contours.type) || 'fill',
        showLines: config.contours ? (config.contours.type === 'lines' || config.contours.type === 'heatmap') : true,
        lineWidth: config.lineWidth || 1.5,
        lineColor: config.lineColor || '#666',
        colorScale: colorScale,
        valueColorMap: config.valueColorMap,
        opacity: config.opacity || 1
    };

    // Render contours
    renderer.renderContours(result, style);

    // Render labels if configured
    if (config.contours && config.contours.showlabels) {
        renderer.renderLabels(result, style);
    }

    // Render axes if configured
    if (config.axes) {
        var axesConfig = Object.assign({}, config.axes, {
            width: width,
            height: height
        });
        renderer.renderAxes(axesConfig, style);
    }

    // Render colorbar if configured
    if (config.colorbar && config.colorbar.show !== false && style.coloring !== 'lines') {
        renderer.renderColorbar(result, colors, config.colorbar);
    }

    // Initialize interaction
    var interactionConfig = config.interaction || {};

    // Merge callbacks into renderer options
    renderer.options.onHoverStart = interactionConfig.hover ? interactionConfig.hover.onHoverStart : null;
    renderer.options.onHoverEnd = interactionConfig.hover ? interactionConfig.hover.onHoverEnd : null;
    renderer.options.onContourClick = interactionConfig.click ? interactionConfig.click.onContourClick : null;
    renderer.options.highlightColor = interactionConfig.highlightColor || '#ffff00';

    if (interactionConfig.zoom !== false) {
        renderer.initZoom(interactionConfig.zoom || {});
    }

    if (interactionConfig.pan !== false) {
        renderer.initPan(interactionConfig.pan || {});
    }

    // Double click to reset
    if (interactionConfig.dblclickReset !== false) {
        renderer.zr.on('dblclick', function() {
            var animate = interactionConfig.animateReset !== false;
            renderer.resetView(animate);
            if (interactionConfig.onReset) {
                interactionConfig.onReset();
            }
        });
    }

    // Return API object
    return {
        // Update data
        update: function(newConfig) {
            if (newConfig.z) grid.z = newConfig.z;
            if (newConfig.x) grid.x = newConfig.x;
            if (newConfig.y) grid.y = newConfig.y;

            result = compute.computeContours(grid, options);

            style.x = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].x : grid.x;
            style.y = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].y : grid.y;
            style.z = result.pathinfo && result.pathinfo[0] ? result.pathinfo[0].z : grid.z;

            renderer.renderContours(result, style);

            if (config.contours && config.contours.showlabels) {
                renderer.renderLabels(result, style);
            }
        },

        // Set view
        setView: function(xMin, xMax, yMin, yMax) {
            // TODO: Implement view range setting
        },

        // Get current view
        getView: function() {
            return renderer.getState();
        },

        // Reset view
        resetView: function() {
            renderer.resetView();
        },

        // Zoom
        zoomTo: function(scale, centerX, centerY, animate) {
            renderer.applyZoom(scale, centerX, centerY);
        },

        // Pan
        panTo: function(dx, dy, animate) {
            var group = renderer.mainGroup;
            group.attr({
                x: group.x + dx,
                y: group.y + dy
            });
            renderer.zr.flush();
        },

        // Enable/disable interaction
        enableInteraction: function(enabled) {
            renderer.setInteractionEnabled(enabled);
        },

        // Event registration
        on: function(event, handler) {
            if (event === 'hover') renderer.options.onHoverStart = handler;
            if (event === 'hoverEnd') renderer.options.onHoverEnd = handler;
            if (event === 'click') renderer.options.onContourClick = handler;
        },

        off: function(event) {
            if (event === 'hover') renderer.options.onHoverStart = null;
            if (event === 'hoverEnd') renderer.options.onHoverEnd = null;
            if (event === 'click') renderer.options.onContourClick = null;
        },

        // Resize
        resize: function(newWidth, newHeight) {
            width = newWidth || width;
            height = newHeight || height;
            renderer.resize(width, height);
        },

        // Destroy
        destroy: function() {
            renderer.dispose();
        },

        // Get renderer
        getRenderer: function() {
            return renderer;
        }
    };
}

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        version: '0.2.0',

        // Core computation
        computeContours: computeContours,
        scalePathsToData: scalePathsToData,

        // Simplified rendering API (NEW in v0.2.0)
        render: render,
        drawTo: drawTo,

        // Null handling (NEW in v0.2.0)
        nullHandling: nullHandling,

        // Color scales
        COLOR_SCALES: COLOR_SCALES
    };
}));

console.log('ContourCore v0.2.0 loaded');
