'use strict';

/**
 * SVG path rendering for contours
 * Based on Plotly's contour filling algorithm
 */

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
 * Generate SVG path element string
 * @param {String} d - Path data
 * @param {Object} attrs - Additional attributes
 * @returns {String} SVG element string
 */
function svgPathElement(d, attrs) {
    attrs = attrs || {};
    var parts = [];

    for (var key in attrs) {
        parts.push(key + '="' + attrs[key] + '"');
    }

    return '<path d="' + d + '" ' + parts.join(' ') + ' />';
}

/**
 * Create perimeter path for boundary closing
 */
function createPerimeter(options) {
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

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
 * Scale path from grid space to canvas space
 */
function scalePath(path, options) {
    var pathinfo = options.pathinfo || options.paths;
    var m = 10, n = 10;
    if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
    }

    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return path.map(function(pt) {
        return [
            padding + pt[0] * scaleX,
            padding + (m - 1 - pt[1]) * scaleY
        ];
    });
}

/**
 * Get color for a contour level
 */
function getColorForLevel(level, levels, options) {
    var colorscale = options.colorscale || 'Viridis';
    var colors = Array.isArray(colorscale) ? colorscale :
                  require('../../colorbar/colors').COLOR_SCALES[colorscale] ||
                  require('../../colorbar/colors').COLOR_SCALES.Viridis;

    var min = levels[0];
    var max = levels[levels.length - 1];
    var t = (level - min) / (max - min);
    var idx = Math.floor(t * (colors.length - 1));
    idx = Math.max(0, Math.min(colors.length - 1, idx));

    return colors[idx];
}

/**
 * Join all edge paths into a single path with proper boundary connections
 * Based on Plotly's joinAllPaths function
 */
function joinAllPaths(pathInfo, perimeter, options) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        // No paths at all
        return '';
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, i) { return i; });
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
        // Scale the current edge path
        var scaledPath = scalePath(edgepaths[i], options);
        addpath = pathToSVG(scaledPath, false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine which corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // right top
            else if (isleft(endpt)) newendpt = perimeter[0]; // left top
            else if (isbottom(endpt)) newendpt = perimeter[3]; // right bottom
            else if (isright(endpt)) newendpt = perimeter[2]; // left bottom

            // Find next path that starts on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                var ptNew = scalePath(edgepaths[possiblei], options)[0];

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

    // Finally add the interior closed paths (THIS WAS MISSING!)
    for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = scalePath(pathInfo.paths[i], options);
        fullpath += pathToSVG(scaledPath, true);
    }

    return fullpath;
}

/**
 * Create SVG filled paths
 * Using even-odd fill rule with prefixBoundary
 * This matches Plotly's original makeFills logic
 */
function createFilledPaths(contourResult, options) {
    options = options || {};
    options.pathinfo = contourResult.pathinfo; // Add pathinfo for scalePath

    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = options.width || 500;
    var height = options.height || 400;
    var perimeter = createPerimeter(options);

    var svgParts = [];

    // First, add the background rectangle within data area only
    // This ensures the base layer is filled ONLY within the data bounds (perimeter)
    if (paths.length > 0) {
        var bgColor = getColorForLevel(levels[0], levels, options);
        var xMin = perimeter[0][0];
        var yMin = perimeter[0][1];
        var bgWidth = perimeter[1][0] - perimeter[0][0];
        var bgHeight = perimeter[2][1] - perimeter[0][1];
        svgParts.push('<rect x="' + xMin + '" y="' + yMin + '" ' +
                     'width="' + bgWidth + '" height="' + bgHeight + '" ' +
                     'fill="' + bgColor + '" stroke="none" />');
    }

    // Draw from LOWEST to HIGHEST (this is critical!)
    // Each level draws the region ABOVE that contour
    // Higher levels cover lower levels, creating the proper gradient
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Use the color corresponding to this level (not midLevel)
        var color = getColorForLevel(pathInfo.level, levels, options);

        // Build the complete path string
        var boundaryPath = 'M' + perimeter.join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, options);
        var fullpath = '';

        // Use prefixBoundary flag to determine if we need to add the boundary
        // This is set by closeBoundaries() function
        if (pathInfo.prefixBoundary) {
            fullpath = boundaryPath + joinedPaths;
        } else {
            fullpath = joinedPaths;
        }

        // Draw the path with even-odd fill rule
        if (fullpath) {
            svgParts.push(svgPathElement(fullpath, {
                fill: color,
                'fill-rule': 'evenodd',
                stroke: 'none',
                'stroke-width': 0
            }));
        }
    }

    return svgParts.join('\n');
}

/**
 * Create SVG stroke paths (contour lines)
 */
function createStrokePaths(contourResult, options) {
    options = options || {};
    options.pathinfo = contourResult.pathinfo;

    var paths = contourResult.paths;
    var lineColor = options.lineColor || '#333';
    var lineWidth = options.lineWidth || 1.5;

    var svgParts = [];

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            var scaled = scalePath(path, options);
            var d = pathToSVG(scaled, true);
            svgParts.push(svgPathElement(d, {
                fill: 'none',
                stroke: lineColor,
                'stroke-width': lineWidth,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round'
            }));
        }

        // Draw edge paths
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            var path = pathInfo.edgepaths[j];
            var scaled = scalePath(path, options);
            var d = pathToSVG(scaled, false);
            svgParts.push(svgPathElement(d, {
                fill: 'none',
                stroke: lineColor,
                'stroke-width': lineWidth,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round'
            }));
        }
    }

    return svgParts.join('\n');
}

module.exports = {
    createFilledPaths: createFilledPaths,
    createStrokePaths: createStrokePaths,
    pathToSVG: pathToSVG,
    svgPathElement: svgPathElement
};
