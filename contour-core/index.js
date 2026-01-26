'use strict';

/**
 * contour-core - Standalone contour calculation library
 * Extracted from Plotly.js for SSR and performance optimization
 *
 * v0.2.0 - Null value support + Simplified rendering API
 */

var api = require('./api');

// Export object
var contourCore = {
    // ============================================
    // Core computation
    // ============================================
    computeContours: require('./compute').computeContours,
    scalePathsToData: require('./compute').scalePathsToData,

    // ============================================
    // Simplified rendering API (NEW in v0.2.0)
    // ============================================
    render: api.render,
    drawTo: api.drawTo,

    // ============================================
    // Low-level modules
    // ============================================
    marchingSquares: require('./marchingsquares'),
    pathFinding: require('./pathfinding'),
    levels: require('./levels'),
    smooth: require('./smooth'),
    constants: require('./constants'),

    // ============================================
    // Feature modules
    // ============================================
    nullHandling: require('./null_handling'),
    labels: require('./labels'),
    colorbar: require('./colorbar'),
    renderers: require('./renderers'),

    // ============================================
    // Utilities
    // ============================================
    COLOR_SCALES: api.COLOR_SCALES
};

// CommonJS export for Node.js and browsers (via bundler)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = contourCore;
}
