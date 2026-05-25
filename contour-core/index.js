'use strict';

/**
 * contour-core - Standalone contour calculation library
 * Extracted from Plotly.js for SSR and performance optimization
 *
 * v0.4.0 - GeoJSON refactor: removed clip logic, dynamic tolerance, smooth/transform/crs options, removed scalePathsToData
 */

var api = require('./api');

// Export object
var contourCore = {
    // ============================================
    // Core computation
    // ============================================
    computeContours: require('./compute').computeContours,

    // ============================================
    // Simplified rendering API (NEW in v0.2.0)
    // ============================================
    render: api.render,
    drawTo: api.drawTo,

    // ============================================
    // GeoJSON export (NEW)
    // ============================================
    toGeoJSON: require('./geojson').toGeoJSON,
    toFilledGeoJSON: require('./geojson').toFilledGeoJSON,
    toNullMaskGeoJSON: require('./geojson').toNullMaskGeoJSON,
    geojsonStringify: require('./geojson').stringify,

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
    axes: require('./axes'),
    interaction: require('./interaction'),
    Overlay: require('./overlay'),

    // ============================================
    // Utilities
    // ============================================
    COLOR_SCALES: api.COLOR_SCALES
};

// CommonJS export for Node.js and browsers (via bundler)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = contourCore;
}

// Browser global - use both 'contourCore' and 'contour' as aliases
if (typeof window !== 'undefined') {
    window.contourCore = contourCore;
    window.contour = contourCore;
}
