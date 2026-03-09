'use strict';

/**
 * Contour computation module
 * Standalone implementation - no external dependencies
 */

var levels = require('./levels');
var marchingSquares = require('./marchingsquares');
var pathFinding = require('./pathfinding');
var nullHandling = require('./null_handling');
var closeBoundaries = require('./close_boundaries');
var findEmpties = require('./null_handling/find_empties');
var interp2d = require('./null_handling/interp2d');

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

module.exports = {
    computeContours: computeContours,
    scalePathsToData: scalePathsToData
};
