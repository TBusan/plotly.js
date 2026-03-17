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
 * Normalize padding to support both number and object formats
 * @param {number|Object} padding - Padding value or object
 * @param {number} [defaultVal] - Default padding value (default: 30)
 * @returns {Object} Normalized padding object { top, right, bottom, left }
 */
function normalizePadding(padding, defaultVal) {
    defaultVal = defaultVal || 30;
    if (typeof padding === 'number') {
        return {
            top: padding,
            right: padding,
            bottom: padding,
            left: padding
        };
    }
    if (typeof padding === 'object' && padding !== null) {
        return {
            top: padding.top !== undefined ? padding.top : defaultVal,
            right: padding.right !== undefined ? padding.right : defaultVal,
            bottom: padding.bottom !== undefined ? padding.bottom : defaultVal,
            left: padding.left !== undefined ? padding.left : defaultVal
        };
    }
    return { top: defaultVal, right: defaultVal, bottom: defaultVal, left: defaultVal };
}

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

    // Get data coordinate arrays (paths are in data coordinates, not grid indices)
    var xData = style.x;
    var yData = style.y;

    // Get grid dimensions for fallback
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;

    // Calculate plot bounds in DATA COORDINATES (matching path coordinates)
    // Paths from computeContours are in data coordinates, so bounds must match
    var plotBounds;
    if (xData && xData.length > 0 && yData && yData.length > 0) {
        var xMin = Math.min.apply(Math, xData);
        var xMax = Math.max.apply(Math, xData);
        var yMin = Math.min.apply(Math, yData);
        var yMax = Math.max.apply(Math, yData);
        plotBounds = {
            left: xMin,
            right: xMax,
            top: yMax,  // Note: in data coords, top is max Y
            bottom: yMin,
            center: (xMin + xMax) / 2,
            middle: (yMin + yMax) / 2
        };
    } else {
        // Fallback to grid coordinates if no data arrays
        plotBounds = {
            left: 0,
            right: n - 1,
            top: m - 1,
            bottom: 0,
            center: (n - 1) / 2,
            middle: (m - 1) / 2
        };
    }

    // Calculate canvas dimensions for scaling
    var width = style.width || 500;
    var height = style.height || 400;
    // Support both number and object format for padding
    var padding = normalizePadding(style.padding, 30);

    // Calculate scale based on data range, not grid size
    var dataXRange = plotBounds.right - plotBounds.left;
    var dataYRange = plotBounds.top - plotBounds.bottom;
    var scaleX = (width - padding.left - padding.right) / (dataXRange || 1);
    var scaleY = (height - padding.top - padding.bottom) / (dataYRange || 1);
    var plotDiagonal = Math.sqrt(dataXRange * dataXRange + dataYRange * dataYRange);

    // Track existing labels in DATA COORDINATES (matching path coordinates)
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
        var scaled = scalePoint(label.pos, n, m, width, height, padding, visibleRange, xData, yData, style.drawArea);

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
 * Scale a point from DATA coordinates to canvas coordinates
 * IMPORTANT: Path points from computeContours are in DATA coordinates (not grid indices)
 * This function transforms data coordinates to canvas pixel coordinates
 * @param {Object} pt - Point with {x, y} in DATA coordinates
 * @param {number} n - Number of columns in grid (for fallback)
 * @param {number} m - Number of rows in grid (for fallback)
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @param {number} padding - Canvas padding
 * @param {Object} visibleRange - Optional visible range {xMin, xMax, yMin, yMax} in data coordinates
 * @param {Object} xData - Optional x data array (for fallback bounds)
 * @param {Object} yData - Optional y data array (for fallback bounds)
 * @param {Object} drawArea - Optional adjusted drawing area for aspect ratio support
 * @returns {Object} Scaled point with {x, y} in canvas pixels
 */
function scalePoint(pt, n, m, width, height, padding, visibleRange, xData, yData, drawArea) {
    // pt.x and pt.y are already in DATA coordinates (from computeContours paths)
    var dataX = pt.x;
    var dataY = pt.y;

    // If drawArea is provided (for aspectRatio: 'equal' support), use it for coordinate transformation
    if (drawArea) {
        var plotWidth = drawArea.width;
        var plotHeight = drawArea.height;
        var offsetX = drawArea.x;
        var offsetY = drawArea.y;

        // If visibleRange is provided, use it for coordinate transformation
        if (visibleRange) {
            var xRange = visibleRange.xMax - visibleRange.xMin;
            var yRange = visibleRange.yMax - visibleRange.yMin;

            var canvasX = offsetX + (dataX - visibleRange.xMin) / xRange * plotWidth;
            var canvasY = offsetY + plotHeight - (dataY - visibleRange.yMin) / yRange * plotHeight;

            return {
                x: canvasX,
                y: canvasY
            };
        }

        // Fallback with drawArea but no visibleRange - use data bounds
        if (xData && xData.length > 0 && yData && yData.length > 0) {
            var xMin = Math.min.apply(Math, xData);
            var xMax = Math.max.apply(Math, xData);
            var yMin = Math.min.apply(Math, yData);
            var yMax = Math.max.apply(Math, yData);
            var xRange = xMax - xMin || 1;
            var yRange = yMax - yMin || 1;

            var canvasX = offsetX + (dataX - xMin) / xRange * plotWidth;
            var canvasY = offsetY + plotHeight - (dataY - yMin) / yRange * plotHeight;

            return {
                x: canvasX,
                y: canvasY
            };
        }

        // Final fallback with drawArea - use grid dimensions
        var scaleX = plotWidth / (n - 1);
        var scaleY = plotHeight / (m - 1);

        return {
            x: offsetX + dataX * scaleX,
            y: offsetY + (m - 1 - dataY) * scaleY
        };
    }

    // Original behavior (no drawArea)
    // Support both number and object format for padding
    var normalizedPadding = normalizePadding(padding, 30);
    var plotWidth = width - normalizedPadding.left - normalizedPadding.right;
    var plotHeight = height - normalizedPadding.top - normalizedPadding.bottom;

    // If visibleRange is provided, use it for coordinate transformation
    if (visibleRange) {
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;

        var canvasX = normalizedPadding.left + (dataX - visibleRange.xMin) / xRange * plotWidth;
        var canvasY = normalizedPadding.top + plotHeight - (dataY - visibleRange.yMin) / yRange * plotHeight;

        return {
            x: canvasX,
            y: canvasY
        };
    }

    // Fallback - use data bounds if available
    if (xData && xData.length > 0 && yData && yData.length > 0) {
        var xMin = Math.min.apply(Math, xData);
        var xMax = Math.max.apply(Math, xData);
        var yMin = Math.min.apply(Math, yData);
        var yMax = Math.max.apply(Math, yData);
        var xRange = xMax - xMin || 1;
        var yRange = yMax - yMin || 1;

        var canvasX = normalizedPadding.left + (dataX - xMin) / xRange * plotWidth;
        var canvasY = normalizedPadding.top + plotHeight - (dataY - yMin) / yRange * plotHeight;

        return {
            x: canvasX,
            y: canvasY
        };
    }

    // Final fallback to grid-based behavior (legacy compatibility)
    var scaleX = plotWidth / (n - 1);
    var scaleY = plotHeight / (m - 1);

    return {
        x: normalizedPadding.left + dataX * scaleX,
        y: normalizedPadding.top + (m - 1 - dataY) * scaleY
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
    // Support both number and object format for padding
    var padding = normalizePadding(style.padding, 30);

    return {
        left: padding.left,
        right: width - padding.right,
        top: padding.top,
        bottom: height - padding.bottom,
        center: width / 2,
        middle: height / 2
    };
}

module.exports = drawLabels;
