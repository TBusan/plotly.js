'use strict';

/**
 * Label density control for contour rendering
 * Based on Plotly's label density algorithm
 */

// Density constants based on Plotly
var DENSITY_CONSTANTS = {
    LABELDISTANCE: 2,    // Each label occupies this length (multiplier of plot diagonal)
    LABELMIN: 3,         // Minimum path length (multiplier of text width)
    LABELMAX: 10,        // Maximum labels per contour line
    LABELINCREASE: 10    // Start increasing density after this many contour levels
};

/**
 * Calculate the maximum number of labels that should be placed on a path
 * Based on Plotly's maxLabels calculation
 * @param {number} pathLen - Length of the contour path
 * @param {number} textWidth - Width of the text label
 * @param {number} textHeight - Height of the text label
 * @param {number} numLevels - Total number of contour levels
 * @param {number} plotDiagonal - Diagonal length of the plot area
 * @returns {number} Maximum number of labels (0 if path is too short)
 */
function calculateMaxLabels(pathLen, textWidth, textHeight, numLevels, plotDiagonal) {
    // 1. Check if path is too short for any labels
    if (pathLen < (textWidth + textHeight) * DENSITY_CONSTANTS.LABELMIN) {
        return 0;
    }

    // 2. Calculate normalized length controlling label density
    var normLength = DENSITY_CONSTANTS.LABELDISTANCE * plotDiagonal /
        Math.max(1, numLevels / DENSITY_CONSTANTS.LABELINCREASE);

    // 3. Calculate maximum number of labels
    return Math.min(
        Math.ceil(pathLen / normLength),
        DENSITY_CONSTANTS.LABELMAX
    );
}

/**
 * Calculate path length from array of points
 * @param {Array} path - Array of [x, y] points
 * @returns {number} Path length
 */
function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
}

/**
 * Get the visible segment of a path (away from edges)
 * Based on Plotly's Lib.getVisibleSegment
 * @param {Array} path - Array of [x, y] points
 * @param {Object} bounds - Plot boundaries {left, right, top, bottom}
 * @param {number} padding - Padding distance from edges
 * @returns {Object|null} Object with {min, max, len, total} or null if no visible segment
 */
function getVisibleSegment(path, bounds, padding) {
    bounds = bounds || {};
    var left = bounds.left !== undefined ? bounds.left : 0;
    var right = bounds.right !== undefined ? bounds.right : 100;
    var top = bounds.top !== undefined ? bounds.top : 0;
    var bottom = bounds.bottom !== undefined ? bounds.bottom : 100;
    padding = padding || 0;

    var totalLen = pathLength(path);
    var min = null;
    var max = null;
    var accumulated = 0;

    // Find the first visible point
    for (var i = 0; i < path.length; i++) {
        var pt = path[i];
        if (pt[0] >= left + padding && pt[0] <= right - padding &&
            pt[1] >= top + padding && pt[1] <= bottom - padding) {
            min = accumulated;
            break;
        }
        if (i > 0) {
            var dx = path[i][0] - path[i - 1][0];
            var dy = path[i][1] - path[i - 1][1];
            accumulated += Math.sqrt(dx * dx + dy * dy);
        }
    }

    if (min === null) return null; // No visible segment

    // Find the last visible point
    accumulated = 0;
    for (var i = path.length - 1; i >= 0; i--) {
        var pt = path[i];
        if (pt[0] >= left + padding && pt[0] <= right - padding &&
            pt[1] >= top + padding && pt[1] <= bottom - padding) {
            max = totalLen - accumulated;
            break;
        }
        if (i < path.length - 1) {
            var dx = path[i + 1][0] - path[i][0];
            var dy = path[i + 1][1] - path[i][1];
            accumulated += Math.sqrt(dx * dx + dy * dy);
        }
    }

    if (max === null) max = totalLen;

    var visibleLen = max - min;

    return {
        min: min,
        max: max,
        len: visibleLen,
        total: totalLen
    };
}

/**
 * Check if a path is closed (start and end points are close)
 * @param {Array} path - Array of [x, y] points
 * @param {number} threshold - Distance threshold for considering closed
 * @returns {boolean} True if path is closed
 */
function isPathClosed(path, threshold) {
    threshold = threshold !== undefined ? threshold : 1;
    if (!path || path.length < 2) return false;

    var start = path[0];
    var end = path[path.length - 1];
    var dx = end[0] - start[0];
    var dy = end[1] - start[1];
    var dist = Math.sqrt(dx * dx + dy * dy);

    return dist < threshold;
}

/**
 * Set density constants (for customization)
 * @param {Object} custom - Custom constants to override
 */
function setDensityConstants(custom) {
    for (var key in custom) {
        if (DENSITY_CONSTANTS.hasOwnProperty(key)) {
            DENSITY_CONSTANTS[key] = custom[key];
        }
    }
}

/**
 * Get current density constants
 * @returns {Object} Copy of density constants
 */
function getDensityConstants() {
    var result = {};
    for (var key in DENSITY_CONSTANTS) {
        result[key] = DENSITY_CONSTANTS[key];
    }
    return result;
}

module.exports = {
    calculateMaxLabels: calculateMaxLabels,
    pathLength: pathLength,
    getVisibleSegment: getVisibleSegment,
    isPathClosed: isPathClosed,
    setDensityConstants: setDensityConstants,
    getDensityConstants: getDensityConstants,
    DENSITY_CONSTANTS: DENSITY_CONSTANTS
};
