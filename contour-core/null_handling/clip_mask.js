'use strict';

/**
 * Generate clip mask path for contour null regions
 * Based on plotly.js src/traces/contour/plot.js clipGaps function
 *
 * When connectgaps=false, instead of drawing rectangles over null areas,
 * we generate a smooth boundary path using marching squares algorithm.
 * This path is then used as a clipPath to hide contours in null regions.
 *
 * The key idea:
 * 1. Create a binary mask (valid data=1, null=0)
 * 2. Run marching squares at level=0.9 to find boundary
 * 3. Generate SVG path from this boundary
 * 4. Use as clipPath or mask in rendering
 */

var marchingSquares = require('../marchingsquares');
var pathFinding = require('../pathfinding');
var closeBoundaries = require('../close_boundaries');

/**
 * Create a binary mask for clipping
 * Valid data points = 1, null/missing points = 0
 *
 * @param {Array} nullMask - Boolean mask from normalizeNullValues (true = null)
 * @returns {Array} Binary mask (1 = data, 0 = null)
 */
function makeBinaryMask(nullMask) {
    if (!nullMask) return null;

    var m = nullMask.length;
    var n = nullMask[0].length;
    var binaryMask = [];

    for (var i = 0; i < m; i++) {
        var row = [];
        for (var j = 0; j < n; j++) {
            // nullMask true means no data, so binary mask is 0
            // nullMask false means has data, so binary mask is 1
            row.push(nullMask[i][j] ? 0 : 1);
        }
        binaryMask.push(row);
    }

    return binaryMask;
}

/**
 * Generate clip path for null regions using marching squares
 *
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} options - Options including width, height, padding
 * @returns {String} SVG path data string for the clip region
 */
function generateClipPath(contourResult, options) {
    options = options || {};

    var nullMask = contourResult.nullMask;
    if (!nullMask || contourResult.nullCount === 0) {
        return null; // No null regions, no clipping needed
    }

    var binaryMask = makeBinaryMask(nullMask);
    if (!binaryMask) return null;

    var m = binaryMask.length;
    var n = binaryMask[0].length;

    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

    // Create x and y coordinate arrays
    var x = [];
    var y = [];
    for (var i = 0; i < n; i++) x.push(i);
    for (var j = 0; j < m; j++) y.push(j);

    // Create pathinfo for clip path generation
    // level = 0.9 means we draw boundary at 90% between null (0) and data (1)
    var clipPathInfo = {
        level: 0.9,
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        z: binaryMask,
        x: x,
        y: y,
        smoothing: 0
    };

    // Run marching squares to find boundary
    marchingSquares.makeCrossings([clipPathInfo]);
    pathFinding.findAllPaths([clipPathInfo], 0.01, 0.01);

    // Close boundaries
    closeBoundaries([clipPathInfo], { type: 'levels' });

    // Generate SVG path from the result
    return createClipPathSVG(clipPathInfo, width, height, padding, m, n);
}

/**
 * Convert path array to SVG path string
 * @param {Array} path - Array of [x, y] points
 * @param {Boolean} isClosed - Whether path is closed
 * @returns {String} SVG path data string
 */
function pathToSVG(path, isClosed) {
    if (!path || path.length === 0) return '';

    var d = 'M ' + path[0][0] + ' ' + path[0][1];
    for (var i = 1; i < path.length; i++) {
        d += ' L ' + path[i][0] + ' ' + path[i][1];
    }
    if (isClosed) {
        d += ' Z';
    }
    return d;
}

/**
 * Convert clip pathinfo to SVG path data
 *
 * @param {Object} clipPathInfo - Pathinfo from marching squares
 * @param {Number} width - Canvas/SVG width
 * @param {Number} height - Canvas/SVG height
 * @param {Number} padding - Padding around plot
 * @param {Number} m - Number of rows
 * @param {Number} n - Number of columns
 * @returns {String} SVG path data string
 */
function createClipPathSVG(clipPathInfo, width, height, padding, m, n) {
    var perimeter = createPerimeter(width, height, padding);
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    // Scale path from grid space to canvas space
    function scalePath(path) {
        return path.map(function(pt) {
            return [
                padding + pt[0] * scaleX,
                padding + (m - 1 - pt[1]) * scaleY
            ];
        });
    }

    // Build the complete path string
    var boundaryPath = 'M' + perimeter.join('L') + 'Z';
    var joinedPaths = joinAllPaths(clipPathInfo, perimeter, scalePath, pathToSVG);

    // The clip path defines the VISIBLE region (data, not null)
    // So we include the boundary and subtract the null region paths
    var fullpath = '';
    if (clipPathInfo.prefixBoundary) {
        fullpath = boundaryPath + joinedPaths;
    } else {
        fullpath = joinedPaths;
    }

    return fullpath;
}

/**
 * Create perimeter path for boundary closing
 */
function createPerimeter(width, height, padding) {
    var xMin = padding;
    var xMax = width - padding;
    var yMin = padding;
    var yMax = height - padding;

    // Clockwise perimeter starting from top-left
    return [
        [xMin, yMin],  // 0: top-left
        [xMax, yMin],  // 1: top-right
        [xMax, yMax],  // 2: bottom-right
        [xMin, yMax]   // 3: bottom-left
    ];
}

/**
 * Join all edge paths into a single path with proper boundary connections
 * Based on plotly.js joinAllPaths function
 * @param {Object} pathInfo - Pathinfo from marching squares
 * @param {Array} perimeter - Perimeter points
 * @param {Function} scalePath - Function to scale path coordinates
 * @param {Function} pathToSVGFn - Function to convert path to SVG string
 * @returns {String} Joined path string
 */
function joinAllPaths(pathInfo, perimeter, scalePath, pathToSVGFn) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        return '';
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, idx) { return idx; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

    function istop(pt) { return Math.abs(pt[1] - perimeter[0][1]) < 0.1; }
    function isbottom(pt) { return Math.abs(pt[1] - perimeter[2][1]) < 0.1; }
    function isleft(pt) { return Math.abs(pt[0] - perimeter[0][0]) < 0.1; }
    function isright(pt) { return Math.abs(pt[0] - perimeter[2][0]) < 0.1; }

    // Process edge paths (open paths that touch the boundary)
    while (startsleft.length > 0) {
        var scaledPath = scalePath(edgepaths[i]);
        addpath = pathToSVGFn(scaledPath, false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine which corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
            else if (isleft(endpt)) newendpt = perimeter[0];
            else if (isbottom(endpt)) newendpt = perimeter[3];
            else if (isright(endpt)) newendpt = perimeter[2];

            // Find next path that starts on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                var ptNew = scalePath(edgepaths[possiblei])[0];

                // Check if ptNew is on the segment from endpt to newendpt
                if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
                    // Vertical edge
                    if (Math.abs(endpt[0] - ptNew[0]) < 0.1 &&
                        (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
                    // Horizontal edge
                    if (Math.abs(endpt[1] - ptNew[1]) < 0.1 &&
                        (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                }
            }

            endpt = newendpt;
            if (nexti >= 0) break;
            fullpath += 'L' + newendpt[0] + ' ' + newendpt[1];
        }

        if (nexti === edgepaths.length || nexti < 0) break;

        i = nexti;
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop) {
            if (startsleft.length > 0) {
                i = startsleft[0];
            }
            fullpath += 'Z';
        }
    }

    // Add interior closed paths
    for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = scalePath(pathInfo.paths[i]);
        fullpath += pathToSVGFn(scaledPath, true);
    }

    return fullpath;
}

module.exports = {
    generateClipPath: generateClipPath,
    makeBinaryMask: makeBinaryMask,
    createClipPathSVG: createClipPathSVG
};
