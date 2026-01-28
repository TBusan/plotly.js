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

/**
 * Compute contours from a 2D grid of values
 *
 * @param {Object} grid - Input data with z (2D array), x, y (optional 1D arrays)
 * @param {Object} options - Contour options (thresholds, autocontour, start, end, size, ncontours, smoothing)
 * @returns {Object} Contour result with levels, paths, pathinfo, nullMask, nullCount, validCount
 */
function computeContours(grid, options) {
    options = options || {};

    // Validate and extract grid data
    if (!grid || !grid.z || !Array.isArray(grid.z)) {
        throw new Error('Invalid grid: must have z property as 2D array');
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;
    if (m < 2 || n < 2) {
        throw new Error('Invalid grid: must have at least 2x2 data points');
    }

    // Normalize null values and create coordinate arrays
    var normalization = nullHandling.normalizeNullValues(z);
    var cleanedZ = normalization.cleanedGrid;
    var nullMask = normalization.nullMask;
    var x = grid.x || createIndexArray(n);
    var y = grid.y || createIndexArray(m);

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
            nullMask: nullMask,
            smoothing: options.smoothing || 0
        };
    });

    // Run marching squares and find all paths
    marchingSquares.makeCrossings(pathinfo);
    pathFinding.findAllPaths(pathinfo, 0.01, 0.01);

    // Close boundaries for proper fill rendering
    var contourOptions = options.contours || {};
    if (!contourOptions.type && !contourOptions.coloring) {
        contourOptions.coloring = 'fill';
    }
    closeBoundaries(pathinfo, contourOptions);

    // Build result object
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
        nullMask: nullMask,
        nullCount: normalization.nullCount,
        validCount: normalization.validCount
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
