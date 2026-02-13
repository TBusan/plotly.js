'use strict';

/**
 * SVG renderer for contour-core
 * Renders contour paths as SVG elements
 */

var createPaths = require('./paths');
var createLabels = require('./labels');
var createColorbar = require('./colorbar');
var createNulls = require('./nulls');
var nullHandling = require('../../null_handling');

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
    var useClipMask = options.useClipMask !== false; // Enable clipPath by default for smoother null masking

    var svgParts = [];
    var clipId = 'clip' + Date.now() + Math.floor(Math.random() * 10000);

    // SVG opening
    svgParts.push(
        '<svg xmlns="http://www.w3.org/2000/svg" ' +
        'width="' + width + '" height="' + height + '" ' +
        'viewBox="0 0 ' + width + ' ' + height + '">'
    );

    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    // Create clipPath if needed (using marching squares for smooth boundary)
    if (needsClip && useClipMask) {
        var clipPathData = nullHandling.generateClipPath(contourResult, options);
        if (clipPathData) {
            svgParts.push(
                '<defs>' +
                '<clipPath id="' + clipId + '">' +
                '<path d="' + clipPathData + '" fill="none" stroke="none"/>' +
                '</clipPath>' +
                '</defs>'
            );
        }
    }

    // Start a group for contours (with clip-path if needed)
    if (needsClip && useClipMask) {
        svgParts.push('<g clip-path="url(#' + clipId + ')">');
    }

    // Draw filled contours
    if (coloring === 'fill' || coloring === 'heatmap') {
        svgParts.push(createPaths.createFilledPaths(contourResult, options));
    }

    // Draw contour lines
    if (showLines && coloring !== 'heatmap') {
        svgParts.push(createPaths.createStrokePaths(contourResult, options));
    }

    // Close the clipped group
    if (needsClip && useClipMask) {
        svgParts.push('</g>');
    }

    // Draw labels (if enabled)
    if (options.showLabels) {
        svgParts.push(createLabels(contourResult, options));
    }

    // Draw colorbar (if enabled)
    if (options.colorbar !== false && coloring !== 'lines') {
        svgParts.push(createColorbar.createColorbar(contourResult, options));
    }

    // Draw null regions as fallback (rectangles) when clipPath is not used
    // IMPORTANT: Only mask when connectgaps is false (like plotly.js does)
    if (needsClip && !useClipMask) {
        svgParts.push(createNulls.createNullRegions(contourResult, options));
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
