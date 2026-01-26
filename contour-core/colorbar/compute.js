'use strict';

/**
 * Compute colorbar data from contour result
 */

/**
 * Compute colorbar information
 * @param {Object} contourResult - Result from computeContours
 * @param {Object} options - Colorbar options
 * @returns {Object} Colorbar data
 */
function computeColorbar(contourResult, options) {
    options = options || {};

    const levels = contourResult.levels;
    if (!levels || levels.length === 0) {
        return null;
    }

    const zmin = options.zmin !== undefined ? options.zmin : levels[0];
    const zmax = options.zmax !== undefined ? options.zmax : levels[levels.length - 1];

    return {
        type: options.coloring || 'fill',
        zmin: zmin,
        zmax: zmax,
        levels: levels,
        colors: options.colors || []
    };
}

module.exports = computeColorbar;
