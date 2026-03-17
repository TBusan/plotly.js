'use strict';

/**
 * SVG null region rendering
 * Highlights areas with null/missing data
 */

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
    // Default case
    return {
        top: defaultVal,
        right: defaultVal,
        bottom: defaultVal,
        left: defaultVal
    };
}

/**
 * Create SVG null regions
 * @param {Object} contourResult - Contour result (must have nullMask)
 * @param {Object} options - Style options
 * @returns {String} SVG string
 */
function createNullRegions(contourResult, options) {
    var nullMask = contourResult.nullMask;
    if (!nullMask) return '';

    options = options || {};
    var nullRegion = options.nullRegion || {};
    var visible = nullRegion.visible !== false;
    if (!visible) return '';

    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = options.width || 500;
    var height = options.height || 400;
    var padding = normalizePadding(options.padding, 30);

    var scaleX = (width - padding.left - padding.right) / (n - 1);
    var scaleY = (height - padding.top - padding.bottom) / (m - 1);

    var fill = nullRegion.fill || '#ffffff';
    var stroke = nullRegion.stroke || '#cccccc';
    var strokeWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;

    var svgParts = [];

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding.left + j * scaleX;
                var y = padding.top + (m - 1 - i) * scaleY;
                var sizeX = scaleX + 1;
                var sizeY = scaleY + 1;

                svgParts.push(
                    '<rect x="' + (x - sizeX / 2) + '" y="' + (y - sizeY / 2) + '" ' +
                    'width="' + sizeX + '" height="' + sizeY + '" ' +
                    'fill="' + fill + '" ' +
                    'stroke="' + stroke + '" stroke-width="' + strokeWidth + '" />'
                );
            }
        }
    }

    return svgParts.join('\n');
}

module.exports = {
    createNullRegions: createNullRegions
};
