'use strict';

/**
 * SVG null region rendering
 * Highlights areas with null/missing data
 */

var scale = require('./scale');

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

    // Place each null cell at its DATA position (x[j], y[i]) rather than at
    // uniform grid spacing — otherwise non-uniform grids draw the mask in the
    // wrong place. Falls back to index spacing when coordinates are absent.
    var pathinfo = contourResult.pathinfo || contourResult.paths;
    var xArr = pathinfo && pathinfo[0] ? pathinfo[0].x : null;
    var yArr = pathinfo && pathinfo[0] ? pathinfo[0].y : null;
    // Pass pathinfo explicitly — the render options object does not carry it,
    // and createTransform would otherwise fall back to a 10×10 default range.
    var t = scale.createTransform({
        width: options.width,
        height: options.height,
        padding: options.padding,
        pathinfo: pathinfo
    });

    var fill = nullRegion.fill || '#ffffff';
    var stroke = nullRegion.stroke || '#cccccc';
    var strokeWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;

    var svgParts = [];

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = t.x(xArr ? xArr[j] : j);
                var y = t.y(yArr ? yArr[i] : i);
                var sizeX = t.scaleX + 1;
                var sizeY = t.scaleY + 1;

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
