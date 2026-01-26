'use strict';

/**
 * Canvas null region drawing
 * Highlights areas with null/missing data
 */

/**
 * Draw null regions on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result (must have nullMask)
 * @param {Object} style - Style options
 */
function drawNulls(ctx, contourResult, style) {
    var nullMask = contourResult.nullMask;
    if (!nullMask) return;

    style = style || {};

    var nullRegion = style.nullRegion || {};
    var visible = nullRegion.visible !== false;
    if (!visible) return;

    var m = nullMask.length;
    var n = nullMask[0].length;

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    ctx.fillStyle = nullRegion.fill || '#ffffff';
    ctx.strokeStyle = nullRegion.stroke || '#cccccc';
    ctx.lineWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;

    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            if (nullMask[i][j]) {
                var x = padding + j * scaleX;
                var y = padding + (m - 1 - i) * scaleY;
                var sizeX = scaleX + 1;
                var sizeY = scaleY + 1;

                ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
            }
        }
    }
}

module.exports = drawNulls;
