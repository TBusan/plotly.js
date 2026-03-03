'use strict';

/**
 * ZRender label rendering for contours
 * Matches canvas/svg implementation with proper label placement algorithm
 */

var zrender = require('zrender');
var labels = require('../../labels');
var findBestTextLocation = labels.findBestTextLocation;
var formatContourLabel = labels.formatContourLabel;
var calculateMaxLabels = labels.calculateMaxLabels;
var pathLength = labels.pathLength;
var isPathClosed = labels.isPathClosed;

/**
 * Create a single label element with background and rotation support
 * @param {Object} labelData - Label data {x, y, theta, text, level}
 * @param {Object} style - Style options
 * @returns {zrender.Group} Label group element
 */
function createLabel(labelData, style) {
    var x = labelData.x;
    var y = labelData.y;
    var theta = labelData.theta || 0;
    var text = labelData.text;
    var level = labelData.level;

    var fontSize = style.labelSize || 12;
    var fontWeight = style.labelFontWeight || 'bold';
    var textColor = style.labelColor || '#000';
    var labelFont = style.labelFont || 'Arial';

    // Estimate text dimensions
    var textWidth = text.length * fontSize * 0.6;
    var textHeight = fontSize * 1.2;

    var padding = style.labelPadding || 3;
    var bgWidth = textWidth + padding * 2;
    var bgHeight = textHeight + padding * 2;
    var cornerRadius = style.labelRadius || 2;

    var group = new zrender.Group();

    // Apply rotation to the group
    group.attr({
        x: x,
        y: y,
        rotation: theta
    });

    // Background rectangle for readability (optional)
    if (style.labelBackground !== false) {
        var bgColor = style.labelBgColor || 'rgba(255, 255, 255, 0.85)';
        var borderColor = style.labelBorderColor || 'rgba(100, 100, 100, 0.5)';
        var borderWidth = style.labelBorderWidth || 1;

        var bgRect = new zrender.Rect({
            shape: {
                x: -bgWidth / 2,
                y: -bgHeight / 2,
                width: bgWidth,
                height: bgHeight,
                r: cornerRadius
            },
            style: {
                fill: bgColor,
                stroke: borderColor,
                lineWidth: borderWidth
            },
            silent: true
        });
        group.add(bgRect);
    }

    // Text element - centered at origin (since group is already positioned)
    var textEl = new zrender.Text({
        style: {
            text: text,
            x: 0,
            y: 0,
            textAlign: 'center',
            textVerticalAlign: 'middle',
            fill: textColor,
            fontSize: fontSize,
            fontWeight: fontWeight,
            fontFamily: labelFont
        },
        silent: true
    });
    group.add(textEl);

    return group;
}

/**
 * Compute labels from contour result using same algorithm as canvas/svg
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style configuration
 * @returns {Array} Array of label data objects
 */
function computeLabels(contourResult, style) {
    style = style || {};

    var paths = contourResult.paths;
    var showLabels = style.showLabels !== false;

    if (!showLabels || !paths || !paths.length) {
        return [];
    }

    // Get grid dimensions for coordinate system
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;

    // Use pathinfo if available for more accurate dimensions
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
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);
    var plotDiagonal = Math.sqrt((n - 1) * (n - 1) + (m - 1) * (m - 1));

    // Track existing labels in GRID COORDINATES
    var existingLabels = [];

    // Track labels to return
    var computedLabels = [];

    var labelSize = style.labelSize || 12;

    // Process each path level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Process interior paths
        if (pathInfo.paths && pathInfo.paths.length > 0) {
            processPathArray(
                pathInfo.paths,
                pathInfo.level,
                existingLabels,
                computedLabels,
                plotBounds,
                plotDiagonal,
                scaleX,
                scaleY,
                m,
                padding,
                style,
                labelSize,
                n
            );
        }

        // Process edge paths
        if (pathInfo.edgepaths && pathInfo.edgepaths.length > 0) {
            processPathArray(
                pathInfo.edgepaths,
                pathInfo.level,
                existingLabels,
                computedLabels,
                plotBounds,
                plotDiagonal,
                scaleX,
                scaleY,
                m,
                padding,
                style,
                labelSize,
                n
            );
        }
    }

    return computedLabels;
}

/**
 * Process an array of paths for label placement
 */
function processPathArray(pathsArray, level, existingLabels, computedLabels,
                          plotBounds, plotDiagonal, scaleX, scaleY, m, padding,
                          style, labelSize, n) {
    for (var j = 0; j < pathsArray.length; j++) {
        var path = pathsArray[j];
        if (!path || path.length < 3) continue;

        // Estimate text dimensions
        var labelText = formatContourLabel(level, style.labelFormat || '.1f');
        var textWidth = labelText.length * labelSize * 0.6;
        var textWidthGrid = textWidth / scaleX;
        var textHeightGrid = labelSize / scaleY;

        // Calculate path length
        var len = pathLength(path);

        // Skip very short paths
        if (len < textWidthGrid) continue;

        // Calculate maximum number of labels for this path
        var maxLabels = calculateMaxLabels(
            len,
            textWidthGrid,
            textHeightGrid,
            pathsArray.length,
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
                    level: level,
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
            var scaledX = padding + labelPos.x * scaleX;
            var scaledY = padding + (m - 1 - labelPos.y) * scaleY;

            // Add to computed labels
            computedLabels.push({
                x: scaledX,
                y: scaledY,
                theta: labelPos.theta || 0,
                text: labelText,
                level: level
            });

            // Add to existing labels in GRID COORDINATES for overlap avoidance
            existingLabels.push({
                x: labelPos.x,
                y: labelPos.y,
                theta: labelPos.theta || 0,
                level: level,
                width: textWidthGrid,
                height: textHeightGrid
            });

            // Mark this position as used
            usedPositions.push(labelPos);
        }
    }
}

/**
 * Create all label elements from contour result
 * @param {Object} contourResult - Contour computation result
 * @param {Object} style - Style options
 * @returns {Array} Array of zrender.Group elements
 */
function createLabels(contourResult, style) {
    var elements = [];

    if (!contourResult || !contourResult.paths) {
        return elements;
    }

    // Compute label positions using same algorithm as canvas/svg
    var computedLabels = computeLabels(contourResult, style);

    // Create zrender elements for each label
    for (var i = 0; i < computedLabels.length; i++) {
        var labelElement = createLabel(computedLabels[i], style);
        elements.push(labelElement);
    }

    return elements;
}

module.exports = {
    createLabel: createLabel,
    createLabels: createLabels,
    computeLabels: computeLabels
};
