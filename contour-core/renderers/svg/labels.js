'use strict';

/**
 * SVG label rendering for contours
 */

var findBestTextLocation = require('../../labels').findBestTextLocation;
var formatContourLabel = require('../../labels').formatContourLabel;

/**
 * Create SVG label elements
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

    var svgParts = [];
    var existingLabels = [];
    var plotBounds = calculatePlotBounds(options);

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Find best position for label
        for (var j = 0; j < pathInfo.paths.length; j++) {
            var path = pathInfo.paths[j];
            if (path.length < 10) continue; // Skip short paths

            // Estimate text width (rough approximation)
            var labelText = formatContourLabel(pathInfo.level, '.1f');
            var textWidth = labelText.length * labelSize * 0.6;
            var textHeight = labelSize;

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

            // Scale position
            var scaled = scalePointForLabel(contourResult, labelPos, options);

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

            // Track this label to avoid overlaps
            existingLabels.push({
                x: scaled.x,
                y: scaled.y,
                theta: labelPos.theta || 0,
                width: textWidth,
                height: textHeight,
                level: pathInfo.level
            });
        }
    }

    return svgParts.join('\n');
}

/**
 * Calculate plot bounds for label placement
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

/**
 * Scale label position
 */
function scalePointForLabel(contourResult, pt, options) {
    // Get grid dimensions from pathinfo
    var pathinfo = contourResult.pathinfo || contourResult.paths;
    var m = 10, n = 10;
    if (pathinfo && pathinfo[0] && pathinfo[0].z) {
        m = pathinfo[0].z.length;
        n = pathinfo[0].z[0].length;
    }

    var width = options.width || 500;
    var height = options.height || 400;
    var padding = options.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
    };
}

module.exports = {
    createLabels: createLabels
};
