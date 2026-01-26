'use strict';

/**
 * Canvas label drawing for contours with optimized label placement
 */

var findBestTextLocation = require('../../labels').findBestTextLocation;
var formatContourLabel = require('../../labels').formatContourLabel;

/**
 * Draw contour labels with overlap avoidance
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

    if (!showLabels) return;

    // Setup context
    ctx.font = labelSize + 'px ' + labelFont;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Track existing labels to avoid overlaps
    var existingLabels = [];
    var plotBounds = calculatePlotBounds(style, contourResult);

    // Process each path level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Find best position for label on each path
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            if (path.length < 10) continue; // Skip very short paths

            // Estimate text dimensions
            var labelText = formatContourLabel(pathInfo.level, '.1f');
            var textWidth = ctx.measureText(labelText).width;
            var textHeight = labelSize;

            // Find optimal label position
            var labelPos = findBestTextLocation(
                path,
                {
                    level: pathInfo.level,
                    width: textWidth,
                    height: textHeight
                },
                existingLabels,
                plotBounds
            );

            if (!labelPos) continue;

            // Scale position to canvas coordinates
            var scaled = scalePointForLabel(style, labelPos);

            // Draw label
            ctx.save();
            ctx.translate(scaled.x, scaled.y);
            ctx.rotate(labelPos.theta || 0);

            // Draw label background (optional, for readability)
            if (style.labelBackground) {
                var bgPadding = 2;
                ctx.fillStyle = style.labelBackground || 'rgba(255,255,255,0.8)';
                ctx.fillRect(
                    -textWidth / 2 - bgPadding,
                    -textHeight / 2 - bgPadding,
                    textWidth + bgPadding * 2,
                    textHeight + bgPadding * 2
                );
                ctx.fillStyle = labelColor;
            }

            ctx.fillText(labelText, 0, 0);
            ctx.restore();

            // Add to existing labels
            existingLabels.push({
                x: scaled.x,
                y: scaled.y,
                theta: labelPos.theta || 0,
                level: pathInfo.level,
                width: textWidth,
                height: textHeight
            });
        }
    }
}

/**
 * Calculate plot bounds for label placement
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

/**
 * Scale label position from grid space to canvas space
 */
function scalePointForLabel(style, pt) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
    };
}

module.exports = drawLabels;
