'use strict';

/**
 * SVG path rendering for contours
 * Converts contour paths to SVG path strings
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
 * Create SVG filled paths
 * @param {Object} contourResult - Contour computation result
 * @param {Object} options - Rendering options
 * @returns {String} SVG string
 */
function createFilledPaths(contourResult, options) {
    options = options || {};
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = options.width || 500;
    var height = options.height || 400;

    var svgParts = [];

    // Draw from HIGHEST to LOWEST for proper layering
    for (var i = paths.length - 1; i >= 0; i--) {
        var pathInfo = paths[i];
        var nextLevel = i < paths.length - 1 ? paths[i + 1].level : levels[levels.length - 1] + 1;
        var midLevel = (pathInfo.level + nextLevel) / 2;
        var color = getColorForLevel(midLevel, levels, options);

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            var d = pathToSVG(scalePath(path, options), true);
            svgParts.push(svgPathElement(d, {
                fill: color,
                stroke: 'none',
                'stroke-width': 0
            }));
        }

        // Draw edge paths (open at boundary)
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            var path = pathInfo.edgepaths[j];
            var d = pathToSVG(scalePath(path, options), false);
            // Close edge paths to boundary
            d = closeEdgePath(d, path, options);
            svgParts.push(svgPathElement(d, {
                fill: color,
                stroke: 'none'
            }));
        }
    }

    return svgParts.join('\n');
}

/**
 * Create SVG stroke paths (contour lines)
 * @param {Object} contourResult - Contour computation result
 * @param {Object} options - Rendering options
 * @returns {String} SVG string
 */
function createStrokePaths(contourResult, options) {
    options = options || {};
    var paths = contourResult.paths;
    var strokeColor = options.strokeColor || '#333';
    var strokeWidth = options.strokeWidth || 1.5;

    var svgParts = [];

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            var d = pathToSVG(scalePath(path, options), true);
            svgParts.push(svgPathElement(d, {
                fill: 'none',
                stroke: strokeColor,
                'stroke-width': strokeWidth
            }));
        }

        // Draw edge paths
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            var path = pathInfo.edgepaths[j];
            var d = pathToSVG(scalePath(path, options), false);
            svgParts.push(svgPathElement(d, {
                fill: 'none',
                stroke: strokeColor,
                'stroke-width': strokeWidth
            }));
        }
    }

    return svgParts.join('\n');
}

/**
 * Scale path to data coordinates
 */
function scalePath(path, options) {
    var m = options.z ? options.z.length : 10;
    var n = options.z && options.z[0] ? options.z[0].length : 10;
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
 * Close edge path to boundary
 */
function closeEdgePath(d, path, options) {
    var first = path[0];
    var last = path[path.length - 1];
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

    var scaledFirst = scalePath([first], options)[0];
    var scaledLast = scalePath([last], options)[0];

    var xMin = padding, xMax = width - padding;
    var yMin = padding, yMax = height - padding;

    // Determine which edge to close to
    if (Math.abs(scaledFirst[0] - xMin) < 1) {  // Left edge
        return d + ' L ' + xMin + ' ' + scaledLast[1] + ' L ' + xMin + ' ' + scaledFirst[1] + ' Z';
    } else if (Math.abs(scaledFirst[0] - xMax) < 1) {  // Right edge
        return d + ' L ' + xMax + ' ' + scaledLast[1] + ' L ' + xMax + ' ' + scaledFirst[1] + ' Z';
    } else if (Math.abs(scaledFirst[1] - yMin) < 1) {  // Top edge
        return d + ' L ' + scaledLast[0] + ' ' + yMin + ' L ' + scaledFirst[0] + ' ' + yMin + ' Z';
    } else {  // Bottom edge
        return d + ' L ' + scaledLast[0] + ' ' + yMax + ' L ' + scaledFirst[0] + ' ' + yMax + ' Z';
    }
}

module.exports = {
    createFilledPaths: createFilledPaths,
    createStrokePaths: createStrokePaths,
    pathToSVG: pathToSVG,
    svgPathElement: svgPathElement
};
