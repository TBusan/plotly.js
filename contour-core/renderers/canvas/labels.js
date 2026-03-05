'use strict';

/**
 * Canvas label drawing for contours with optimized label placement
 * Now supports multi-label placement and unified coordinate system
 */

var labels = require('../../labels');
var findBestTextLocation = labels.findBestTextLocation;
var formatContourLabel = labels.formatContourLabel;
var calculateMaxLabels = labels.calculateMaxLabels;
var pathLength = labels.pathLength;
var isPathClosed = labels.isPathClosed;

/**
 * Draw contour labels with overlap avoidance
 * Now supports multiple labels per path and uses unified coordinate system
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 */
function drawLabels(ctx, contourResult, style) {
    style = style || {};

    var paths = contourResult.paths;
    var labelFont = style.labelFont || 'Arial';
    var labelSize = style.labelSize || 12;
    var labelColor = style.labelColor || '#000';
    var showLabels = style.showLabels !== false;

    if (!showLabels || !paths || !paths.length) return;

    // Setup context
    ctx.font = labelSize + 'px ' + labelFont;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Get grid dimensions for coordinate system
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;

    // Calculate plot bounds in GRID COORDINATES (not canvas coordinates)
    // This is key for unified coordinate system
    var plotBounds = {
        left: 0,
        right: n - 1,
        top: 0,
        bottom: m - 1,
        center: (n - 1) / 2,
        middle: (m - 1) / 2
    };

    // Calculate canvas dimensions for scaling
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);
    var plotDiagonal = Math.sqrt((n - 1) * (n - 1) + (m - 1) * (m - 1));

    // Track existing labels in GRID COORDINATES for consistent cost calculation
    var existingLabels = [];

    // Track placed labels for rendering
    var labelsToDraw = [];

    // Process each path level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Find best position for label(s) on each path
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            if (path.length < 3) continue; // Skip very short paths

            // Estimate text dimensions
            var labelText = formatContourLabel(pathInfo.level, '.1f');
            var textWidth = ctx.measureText(labelText).width;
            // Convert text width from canvas pixels to grid units for cost calculation
            var textWidthGrid = textWidth / scaleX;
            var textHeightGrid = labelSize / scaleY;

            // Calculate path length in grid units
            var len = pathLength(path);

            // Calculate maximum number of labels for this path
            var maxLabels = calculateMaxLabels(
                len,
                textWidthGrid,
                textHeightGrid,
                paths.length,
                plotDiagonal
            );

            if (maxLabels === 0) continue;

            // Check if path is closed
            var closed = isPathClosed(path);

            // Track used positions on this path to avoid placing labels too close
            var usedPositions = [];

            // Try to place multiple labels
            for (var k = 0; k < maxLabels; k++) {
                // Find optimal label position
                var labelPos = findBestTextLocation(
                    path,
                    {
                        level: pathInfo.level,
                        width: textWidthGrid,
                        height: textHeightGrid
                    },
                    existingLabels,
                    plotBounds,
                    closed
                );

                if (!labelPos) break; // No suitable position found

                // Check if this position is too close to existing labels on same path
                var tooClose = false;
                for (var u = 0; u < usedPositions.length; u++) {
                    var dx = labelPos.x - usedPositions[u].x;
                    var dy = labelPos.y - usedPositions[u].y;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < textWidthGrid * 2) {
                        tooClose = true;
                        break;
                    }
                }

                if (tooClose) break;

                // Store label data for rendering
                labelsToDraw.push({
                    text: labelText,
                    pos: labelPos,
                    level: pathInfo.level,
                    textColor: labelColor
                });

                // Add to existing labels in GRID COORDINATES
                existingLabels.push({
                    x: labelPos.x,
                    y: labelPos.y,
                    theta: labelPos.theta || 0,
                    level: pathInfo.level,
                    width: textWidthGrid,
                    height: textHeightGrid
                });

                // Mark this position as used
                usedPositions.push(labelPos);

                // For closed paths, mark the opposite side as used to maintain spacing
                if (closed) {
                    var midLen = len / 2;
                    var oppositeLen = (usedPositions[usedPositions.length - 2] ?
                        (pathLength(path) / 2 + midLen) % len : midLen);
                }
            }
        }
    }

    // Now render all labels
    // Get x, y data for coordinate mapping
    var xData = style.x;
    var yData = style.y;
    var visibleRange = style.visibleRange;

    for (var i = 0; i < labelsToDraw.length; i++) {
        var label = labelsToDraw[i];
        var scaled = scalePoint(label.pos, n, m, width, height, padding, visibleRange, xData, yData);

        // Draw label
        ctx.save();
        ctx.translate(scaled.x, scaled.y);
        ctx.rotate(label.pos.theta || 0);

        // Draw label background (optional, for readability)
        if (style.labelBackground) {
            var bgPadding = 2;
            ctx.fillStyle = style.labelBackground || 'rgba(255,255,255,0.8)';
            var bgWidth = ctx.measureText(label.text).width;
            var bgHeight = labelSize;
            ctx.fillRect(
                -bgWidth / 2 - bgPadding,
                -bgHeight / 2 - bgPadding,
                bgWidth + bgPadding * 2,
                bgHeight + bgPadding * 2
            );
            ctx.fillStyle = label.textColor;
        }

        ctx.fillText(label.text, 0, 0);
        ctx.restore();
    }
}

/**
 * Scale a point from grid coordinates to canvas coordinates
 * Now supports visibleRange for zoom/pan interaction
 * @param {Object} pt - Point with {x, y} in grid coordinates
 * @param {number} n - Number of columns in grid
 * @param {number} m - Number of rows in grid
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} padding - Canvas padding
 * @param {Object} visibleRange - Optional visible range {xMin, xMax, yMin, yMax} in data coordinates
 * @param {Object} xData - Optional x data array for coordinate mapping
 * @param {Object} yData - Optional y data array for coordinate mapping
 * @returns {Object} Scaled point with {x, y}
 */
function scalePoint(pt, n, m, width, height, padding, visibleRange, xData, yData) {
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // If visibleRange is provided, use it for coordinate transformation
    if (visibleRange) {
        // Convert grid coordinates to data coordinates first
        // Grid x (0 to n-1) maps to data x (xData[0] to xData[n-1])
        // Grid y (0 to m-1) maps to data y (yData[0] to yData[m-1])
        var dataX, dataY;

        if (xData && xData.length > 0) {
            // Interpolate to get data coordinate
            var xIdx = pt.x;
            var xIdx0 = Math.floor(xIdx);
            var xFrac = xIdx - xIdx0;
            if (xIdx0 >= xData.length - 1) {
                dataX = xData[xData.length - 1];
            } else if (xIdx0 < 0) {
                dataX = xData[0];
            } else {
                dataX = xData[xIdx0] + xFrac * (xData[xIdx0 + 1] - xData[xIdx0]);
            }
        } else {
            // Fallback: assume grid coordinates equal data coordinates
            dataX = pt.x;
        }

        if (yData && yData.length > 0) {
            var yIdx = pt.y;
            var yIdx0 = Math.floor(yIdx);
            var yFrac = yIdx - yIdx0;
            if (yIdx0 >= yData.length - 1) {
                dataY = yData[yData.length - 1];
            } else if (yIdx0 < 0) {
                dataY = yData[0];
            } else {
                dataY = yData[yIdx0] + yFrac * (yData[yIdx0 + 1] - yData[yIdx0]);
            }
        } else {
            dataY = pt.y;
        }

        // Now convert data coordinates to canvas coordinates using visibleRange
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;

        var canvasX = padding + (dataX - visibleRange.xMin) / xRange * plotWidth;
        var canvasY = padding + plotHeight - (dataY - visibleRange.yMin) / yRange * plotHeight;

        return {
            x: canvasX,
            y: canvasY
        };
    }

    // Fallback to original behavior (no visibleRange)
    var scaleX = plotWidth / (n - 1);
    var scaleY = plotHeight / (m - 1);

    return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
    };
}

/**
 * Calculate plot bounds for label placement
 * Kept for backward compatibility
 */
function calculatePlotBounds(style, contourResult) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    return {
        left: padding,
        right: width - padding,
        top: padding,
        bottom: height - padding,
        center: width / 2,
        middle: height / 2
    };
}

module.exports = drawLabels;
