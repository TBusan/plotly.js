'use strict';

/**
 * Colorbar module for contour rendering
 * Handles colorbar computation, ticks, and color mapping
 */

var colors = require('./colors');

module.exports = {
    computeColorbar: require('./compute'),
    computeTicks: require('./ticks'),
    mapColors: colors.mapColors,
    buildColorScale: colors.buildColorScale,
    COLOR_SCALES: colors.COLOR_SCALES
};
