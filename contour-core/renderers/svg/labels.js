'use strict';

/**
 * SVG label rendering for contours
 * Now supports multi-label placement and unified coordinate system
 */

var labels = require('../../labels');
var findBestTextLocation = labels.findBestTextLocation;
var formatContourLabel = labels.formatContourLabel;
var calculateMaxLabels = labels.calculateMaxLabels;
var pathLength = labels.pathLength;
var isPathClosed = labels.isPathClosed;

/**
 * Create SVG label elements
 * Now supports multiple labels per path and uses unified coordinate system
 * @param {Object} contourResult - Contour computation result
 * @param {Object} options - Rendering options
 * @returns {String} SVG string
 */
function createLabels(contourResult, options) {
    options = options || {};
    var paths = contourResult.paths;
    var labelFont = options.labelFont || 'Arial';
    var labelSize = options.labelSize || 12;
    var labelColor = options.labelColor || '#000';

    if (!paths || !paths.length) return '';

    var svgParts = [];

    // Get grid dimensions for coordinate system
    var m = 10, n = 10;
    var pathinfo = contourResult.pathinfo || contourResult.paths;
    if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
    }

    // Calculate plot bounds in GRID COORDINATES
    var plotBounds = {
        left: 0,
        right: n - 1,
        top: 0,
        bottom: m - 1,
        center: (n - 1) / 2,
        middle: (m - 1) / 2
    };

    // Calculate canvas dimensions for scaling
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);
    var plotDiagonal = Math.sqrt((n - 1) * (n - 1) + (m - 1) * (m - 1));

    // Track existing labels in GRID COORDINATES
    var existingLabels = [];

    // Process each path level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Find best position for label(s) on each path
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            if (path.length < 3) continue; // Skip very short paths

            // Estimate text dimensions
            var labelText = formatContourLabel(pathInfo.level, '.1f');
            var textWidth = labelText.length * labelSize * 0.6;
            // Convert text width from canvas pixels to grid units
            var textWidthGrid = textWidth / scaleX;
            var textHeightGrid = labelSize / scaleY;

            // Calculate path length
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

            // Track used positions on this path
            var usedPositions = [];

            // Try to place multiple labels
            for (var k = 0; k < maxLabels; k++) {
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

                if (!labelPos) break;

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

                // Scale position to canvas coordinates
                var scaled = {
                    x: padding + labelPos.x * scaleX,
                    y: padding + (m - 1 - labelPos.y) * scaleY
                };

                // Create SVG text element
                var transform = 'translate(' + scaled.x + ' ' + scaled.y + ') rotate(' +
                                (labelPos.theta || 0) * 180 / Math.PI + ')';

                svgParts.push(
                    '<text x="0" y="0" transform="' + transform + '" ' +
                    'font-family="' + labelFont + '" ' +
                    'font-size="' + labelSize + '" ' +
                    'fill="' + labelColor + '" ' +
                    'text-anchor="middle" ' +
                    'dominant-baseline="middle">' +
                    labelText +
                    '</text>'
                );

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
            }
        }
    }

    return svgParts.join('\n');
}

/**
 * Calculate plot bounds for label placement (kept for compatibility)
 */
function calculatePlotBounds(options) {
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

    return {
        left: padding,
        right: width - padding,
        top: padding,
        bottom: height - padding,
        center: width / 2,
        middle: height / 2
    };
}

module.exports = {
    createLabels: createLabels
};
