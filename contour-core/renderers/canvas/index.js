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
var axesRenderer = require('./axes');
var nullHandling = require('../../null_handling');

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
    var useClipMask = style.useClipMask !== false; // Enable clipPath by default for smoother null masking

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    var connectGaps = contourResult.connectgaps !== undefined ? contourResult.connectgaps : true;
    var needsClip = !connectGaps && contourResult.nullMask && contourResult.nullCount > 0;

    // Apply clip path if needed (using marching squares for smooth boundary)
    if (needsClip && useClipMask) {
        var clipPathData = nullHandling.generateClipPath(contourResult, style);
        if (clipPathData) {
            applyCanvasClip(ctx, clipPathData, width, height);
        }
    }

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

    // Restore context (remove clip)
    if (needsClip && useClipMask) {
        ctx.restore();
    }

    // Draw labels (if enabled)
    if (style.showLabels) {
        drawLabels(ctx, contourResult, style);
    }

    // Draw colorbar (if enabled)
    if (style.colorbar !== false && coloring !== 'lines') {
        drawColorbar(ctx, contourResult, style);
    }

    // Draw null regions as fallback (rectangles) when clipPath is not used
    // IMPORTANT: Only mask when connectgaps is false (like plotly.js does)
    if (needsClip && !useClipMask) {
        drawNulls(ctx, contourResult, style);
    }
}

/**
 * Apply SVG path data as a clipping region to canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {String} pathData - SVG path data string
 * @param {Number} width - Canvas width
 * @param {Number} height - Canvas height
 */
function applyCanvasClip(ctx, pathData, width, height) {
    ctx.save();

    // Parse SVG path data and create canvas path
    parseSVGPathToCanvas(ctx, pathData);

    // Apply clipping
    ctx.clip();
}

/**
 * Parse SVG path data and draw it on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {String} pathData - SVG path data string
 */
function parseSVGPathToCanvas(ctx, pathData) {
    var commands = pathData.split(/[MmLlHhVvAaQqTtCcSsZz]/);
    var types = pathData.match(/[MmLlHhVvAaQqTtCcSsZz]/g) || [];

    var currentX = 0, currentY = 0;
    var startX = 0, startY = 0;

    ctx.beginPath();

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        var args = commands[i + 1] ? commands[i + 1].trim().split(/[\s,]+/).map(parseFloat) : [];

        switch (type) {
            case 'M':
                ctx.moveTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                startX = args[0];
                startY = args[1];
                break;
            case 'm':
                ctx.moveTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                startX = currentX;
                startY = currentY;
                break;
            case 'L':
                ctx.lineTo(args[0], args[1]);
                currentX = args[0];
                currentY = args[1];
                break;
            case 'l':
                ctx.lineTo(currentX + args[0], currentY + args[1]);
                currentX += args[0];
                currentY += args[1];
                break;
            case 'H':
                ctx.lineTo(args[0], currentY);
                currentX = args[0];
                break;
            case 'h':
                ctx.lineTo(currentX + args[0], currentY);
                currentX += args[0];
                break;
            case 'V':
                ctx.lineTo(currentX, args[0]);
                currentY = args[0];
                break;
            case 'v':
                ctx.lineTo(currentX, currentY + args[0]);
                currentY += args[0];
                break;
            case 'Z':
            case 'z':
                ctx.closePath();
                currentX = startX;
                currentY = startY;
                break;
            default:
                // For arc and bezier commands, simplify to line to for now
                if (args.length >= 2) {
                    ctx.lineTo(args[args.length - 2], args[args.length - 1]);
                }
                break;
        }
    }
}

module.exports = {
    drawContours: drawContours,
    drawPaths: drawPaths,
    drawLabels: drawLabels,
    drawColorbar: drawColorbar,
    drawNulls: drawNulls,
    drawHeatmap: drawHeatmap,
    drawAxes: axesRenderer.drawAxes
};
