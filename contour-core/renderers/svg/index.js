'use strict';

/**
 * SVG renderer for contour-core
 * Renders contour paths as SVG elements
 */

var createPaths = require('./paths');
var createLabels = require('./labels');
var createColorbar = require('./colorbar');
var createNulls = require('./nulls');

/**
 * Render contours as SVG
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} options - Rendering options
 * @returns {String} Complete SVG string
 */
function renderSVG(contourResult, options) {
    options = options || {};

    var width = options.width || 500;
    var height = options.height || 400;
    var coloring = options.coloring || 'fill';
    var showLines = options.showLines !== false;

    var svgParts = [];

    // SVG opening
    svgParts.push(
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="' + width + '" height="' + height + '" ' +
        'viewBox="0 0 ' + width + ' ' + height + '">'
    );

    // Draw null regions first (if present)
    if (contourResult.nullMask && contourResult.nullCount > 0) {
        svgParts.push(createNulls.createNullRegions(contourResult, options));
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'heatmap') {
        svgParts.push(createPaths.createFilledPaths(contourResult, options));
    }

    // Draw contour lines
    if (showLines && coloring !== 'heatmap') {
        svgParts.push(createPaths.createStrokePaths(contourResult, options));
    }

    // Draw labels (if enabled)
    if (options.showLabels) {
        svgParts.push(createLabels.createLabels(contourResult, options));
    }

    // Draw colorbar (if enabled)
    if (options.colorbar !== false && coloring !== 'lines') {
        svgParts.push(createColorbar.createColorbar(contourResult, options));
    }

    // SVG closing
    svgParts.push('</svg>');

    return svgParts.join('\n');
}

/**
 * Get SVG string for paths only (for custom use)
 */
function toSVG(contourResult, options) {
    return renderSVG(contourResult, options);
}

module.exports = {
    renderSVG: renderSVG,
    toSVG: toSVG,
    createPaths: createPaths,
    createFilledPaths: createPaths.createFilledPaths,
    createStrokePaths: createPaths.createStrokePaths,
    createLabels: createLabels,
    createColorbar: createColorbar,
    createNulls: createNulls
};
