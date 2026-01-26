'use strict';

/**
 * Main contour computation module
 * Standalone implementation - no dependencies on Plotly, D3, or browser APIs
 */

var levels = require('./levels');
var marchingSquares = require('./marchingsquares');
var pathFinding = require('./pathfinding');
var nullHandling = require('./null_handling');
var closeBoundaries = require('./close_boundaries');

/**
 * Compute contours from a 2D grid of values
 *
 * @param {Object} grid - Input data
 * @param {Array} grid.z - 2D array of z values
 * @param {Array} grid.x - 1D array of x coordinates (optional, defaults to indices)
 * @param {Array} grid.y - 1D array of y coordinates (optional, defaults to indices)
 *
 * @param {Object} options - Contour computation options
 * @param {Array} options.thresholds - Custom threshold values (optional)
 * @param {Boolean} options.autocontour - Auto-generate contour levels (default: true)
 * @param {Number} options.start - Start value for contours (optional)
 * @param {Number} options.end - End value for contours (optional)
 * @param {Number} options.size - Step size between contours (optional)
 * @param {Number} options.ncontours - Approximate number of contours (default: 15)
 * @param {Number} options.smoothing - Smoothing factor for paths (0-1, default: 0)
 *
 * @returns {Object} Contour result containing:
 *   - levels: Array of contour level values
 *   - paths: Array of path objects, one per level
 *     - level: the contour level value
 *     - edgepaths: Array of edge paths (not closed)
 *     - paths: Array of closed paths
 *     Each path is an array of [x, y] coordinates
 */
function computeContours(grid, options) {
    options = options || {};

    // Validate input
    if (!grid || !grid.z || !Array.isArray(grid.z)) {
        throw new Error('Invalid grid: must have z property as 2D array');
    }

    var z = grid.z;
    var m = z.length;
    if (m < 2) {
        throw new Error('Invalid grid: must have at least 2 rows');
    }
    var n = z[0].length;
    if (n < 2) {
        throw new Error('Invalid grid: must have at least 2 columns');
    }

    // Normalize null values (convert null/undefined to NaN)
    var normalization = nullHandling.normalizeNullValues(z);
    var cleanedZ = normalization.cleanedGrid;
    var nullMask = normalization.nullMask;

    // Create x and y coordinate arrays if not provided
    var x = grid.x || [];
    var y = grid.y || [];
    if (x.length === 0) {
        for (var i = 0; i < n; i++) x.push(i);
    }
    if (y.length === 0) {
        for (var j = 0; j < m; j++) y.push(j);
    }

    // Compute contour levels (using cleaned grid with NaN values)
    var contourLevels = levels.setContours(options, cleanedZ);

    if (contourLevels.length === 0) {
        return {
            levels: [],
            paths: []
        };
    }

    // Limit to maximum of 1000 contours
    if (contourLevels.length > 1000) {
        console.warn('Too many contours (' + contourLevels.length + '), clipping at 1000');
        contourLevels = contourLevels.slice(0, 1000);
    }

    // Create pathinfo array for all levels
    var pathinfo = [];
    for (var i = 0; i < contourLevels.length; i++) {
        pathinfo.push({
            level: contourLevels[i],
            crossings: {},
            starts: [],
            edgepaths: [],
            paths: [],
            z: cleanedZ,
            x: x,
            y: y,
            nullMask: nullMask,
            smoothing: options.smoothing || 0
        });
    }

    // Run marching squares algorithm (will skip null cells)
    marchingSquares.makeCrossings(pathinfo);

    // Find all paths
    pathFinding.findAllPaths(pathinfo, 0.01, 0.01);

    // Close boundaries for proper fill rendering
    // This must be called after findAllPaths and before returning results
    // It sets prefixBoundary flags needed for correct even-odd fill rule
    var contourOptions = options.contours || {};
    closeBoundaries(pathinfo, contourOptions);

    // Convert paths to normalized format
    // Note: The paths are currently in grid index space
    // You can scale them to data space or pixel space as needed
    var result = {
        levels: contourLevels,
        paths: pathinfo.map(function(pi) {
            return {
                level: pi.level,
                edgepaths: pi.edgepaths,
                paths: pi.paths,
                prefixBoundary: pi.prefixBoundary  // Added for correct fill logic
            };
        }),
        // Include raw pathinfo for advanced rendering
        pathinfo: pathinfo,
        // Include null mask and statistics for rendering layer
        nullMask: nullMask,
        nullCount: normalization.nullCount,
        validCount: normalization.validCount
    };

    return result;
}

/**
 * Scale paths from grid index space to data space
 *
 * @param {Object} result - Result from computeContours
 * @param {Array} x - X coordinate array
 * @param {Array} y - Y coordinate array
 * @returns {Object} Result with scaled paths
 */
function scalePathsToData(result, x, y) {
    var n = x.length;
    var m = y.length;

    function scalePoint(pt) {
        var ix = Math.round(pt[0]);
        var iy = Math.round(pt[1]);
        // Clamp to valid range
        ix = Math.max(0, Math.min(n - 1, ix));
        iy = Math.max(0, Math.min(m - 1, iy));
        return [x[ix], y[iy]];
    }

    result.paths.forEach(function(pathInfo) {
        pathInfo.edgepaths = pathInfo.edgepaths.map(function(path) {
            return path.map(scalePoint);
        });
        pathInfo.paths = pathInfo.paths.map(function(path) {
            return path.map(scalePoint);
        });
    });

    return result;
}

module.exports = {
    computeContours: computeContours,
    scalePathsToData: scalePathsToData
};
