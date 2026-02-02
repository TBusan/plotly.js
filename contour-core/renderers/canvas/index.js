'use strict';

/**
 * Canvas renderer for contour-core
 * Main entry point for canvas rendering
 */

var drawPaths = require('./paths');
var drawLabels = require('./labels');
var drawColorbar = require('./colorbar');
var drawNulls = require('./nulls');
var drawHeatmap = require('./heatmap');

/**
 * Draw contours on a canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 */
function drawContours(ctx, contourResult, style) {
    style = style || {};

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var coloring = style.coloring || 'lines';
    var showLines = style.showLines !== false;
    var smoothing = style.smoothing || 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // NOTE: Draw null regions AFTER contours to mask them out
    // This ensures contours don't appear in null regions

    // Draw heatmap background if coloring mode is 'heatmap'
    if (coloring === 'heatmap') {
        drawHeatmap.drawInterpolatedHeatmap(ctx, {
            z: contourResult.pathinfo[0].z,
            x: contourResult.pathinfo[0].x,
            y: contourResult.pathinfo[0].y
        }, style);
    }

    // Draw filled contours
    // NOTE: drawFilledPaths now also draws stroke lines when showLines is true
    // This avoids double-smoothing and ensures lines match fills exactly
    if (coloring === 'fill' || coloring === 'heatmap') {
        drawPaths.drawFilledPaths(ctx, contourResult, style);
    }

    // Draw contour lines (ONLY for lines mode, NOT for fill mode)
    // For fill mode, lines are already drawn in drawFilledPaths
    if (showLines && coloring === 'lines') {
        drawPaths.drawStrokePaths(ctx, contourResult, style);
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, style);
    }

    // Draw colorbar (if enabled)
    if (style.colorbar !== false && coloring !== 'lines') {
        drawColorbar(ctx, contourResult, style);
    }

    // Draw null regions LAST to mask out contours in null areas
    // This ensures contours don't cross into null regions
    // IMPORTANT: Only mask when connectgaps is false (like plotly.js does)
    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    if (!connectGaps && contourResult.nullMask && contourResult.nullCount > 0) {
        drawNulls(ctx, contourResult, style);
    }
}

module.exports = {
    drawContours: drawContours,
    drawPaths: drawPaths,
    drawLabels: drawLabels,
    drawColorbar: drawColorbar,
    drawNulls: drawNulls,
    drawHeatmap: drawHeatmap
};
