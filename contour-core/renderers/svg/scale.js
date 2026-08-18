'use strict';

/**
 * Shared SVG data→pixel scaling.
 *
 * Contour paths produced by the compute layer are in DATA space (interpolated
 * through the grid's x[]/y[] coordinate arrays), so every SVG renderer must
 * map data coordinates onto the canvas — NOT treat points as grid indices
 * [0,n-1]×[0,m-1]. For index-based data (x/y = [0,1,2,…]) the two coincide,
 * which is why the old index-based math "worked" in the demos but exploded
 * on non-uniform grids (e.g. a data point [250, 0] rendered 27,530px off-canvas).
 */

/**
 * Normalize padding to support both number and object formats
 * @param {number|Object} padding - Padding value or object
 * @param {number} [defaultVal] - Default padding value (default: 30)
 * @returns {Object} Normalized padding object { top, right, bottom, left }
 */
function normalizePadding(padding, defaultVal) {
    defaultVal = defaultVal || 30;
    if (typeof padding === 'number') {
        return {
            top: padding,
            right: padding,
            bottom: padding,
            left: padding
        };
    }
    if (typeof padding === 'object' && padding !== null) {
        return {
            top: padding.top !== undefined ? padding.top : defaultVal,
            right: padding.right !== undefined ? padding.right : defaultVal,
            bottom: padding.bottom !== undefined ? padding.bottom : defaultVal,
            left: padding.left !== undefined ? padding.left : defaultVal
        };
    }
    return {
        top: defaultVal,
        right: defaultVal,
        bottom: defaultVal,
        left: defaultVal
    };
}

/**
 * Get the data range from a pathinfo array's x/y coordinate arrays.
 * Falls back to grid-index range [0,n-1]×[0,m-1] when coordinates are absent
 * (e.g. the raw-array grid form), which keeps behavior identical for index data.
 * Uses plain loops — Math.min.apply overflows the stack on large grids.
 *
 * @param {Array} pathinfo - pathinfo array (pathinfo[0] carries x/y/z)
 * @param {Number} m - grid row count (fallback)
 * @param {Number} n - grid col count (fallback)
 * @returns {Object} { xMin, xMax, yMin, yMax }
 */
function getDataRange(pathinfo, m, n) {
    var x = pathinfo && pathinfo[0] ? pathinfo[0].x : null;
    var y = pathinfo && pathinfo[0] ? pathinfo[0].y : null;

    var xMin = Infinity, xMax = -Infinity, i, v;
    if (x && x.length > 0) {
        for (i = 0; i < x.length; i++) {
            v = x[i];
            if (v < xMin) xMin = v;
            if (v > xMax) xMax = v;
        }
    } else {
        xMin = 0;
        xMax = (n || 10) - 1;
    }

    var yMin = Infinity, yMax = -Infinity;
    if (y && y.length > 0) {
        for (i = 0; i < y.length; i++) {
            v = y[i];
            if (v < yMin) yMin = v;
            if (v > yMax) yMax = v;
        }
    } else {
        yMin = 0;
        yMax = (m || 10) - 1;
    }

    return { xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax };
}

/**
 * Build a data→pixel transform for the given render options.
 * Data (xMin,yMin) maps to the bottom-left of the plot area; the Y axis is
 * flipped so data-top sits at padding.top (SVG Y grows downward), matching
 * the canvas renderer's convention.
 *
 * @param {Object} options - { width, height, padding, pathinfo|paths }
 * @returns {Object} { x(dx), y(dy), range, scaleX, scaleY, plotWidth, plotHeight, padding }
 */
function createTransform(options) {
    options = options || {};
    var pathinfo = options.pathinfo || options.paths;
    var m = 10, n = 10;
    if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
    }

    var r = getDataRange(pathinfo, m, n);
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = normalizePadding(options.padding, 30);

    var plotWidth = width - padding.left - padding.right;
    var plotHeight = height - padding.top - padding.bottom;
    var xRange = (r.xMax - r.xMin) || 1;
    var yRange = (r.yMax - r.yMin) || 1;
    var scaleX = plotWidth / xRange;
    var scaleY = plotHeight / yRange;

    return {
        x: function(dx) { return padding.left + (dx - r.xMin) * scaleX; },
        y: function(dy) { return padding.top + (r.yMax - dy) * scaleY; },
        range: r,
        scaleX: scaleX,
        scaleY: scaleY,
        plotWidth: plotWidth,
        plotHeight: plotHeight,
        padding: padding
    };
}

module.exports = {
    normalizePadding: normalizePadding,
    getDataRange: getDataRange,
    createTransform: createTransform
};
