'use strict';

/**
 * Canvas null region drawing
 * Highlights areas with null/missing data
 */

/**
 * Draw null regions on canvas
 * This function masks out contour lines and fills in null data areas
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

    // Save context state
    ctx.save();

    // Fill null regions with background color to mask contours
    var fillColor = nullRegion.fill || nullRegion.bgColor || '#ffffff';
    if (fillColor !== 'transparent') {
        ctx.fillStyle = fillColor;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    var x = padding + j * scaleX;
                    var y = padding + (m - 1 - i) * scaleY;
                    var sizeX = scaleX + 1;
                    var sizeY = scaleY + 1;

                    // Draw filled rectangle to mask contour
                    ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                }
            }
        }
    } else {
        // Use destination-out to make null regions transparent
        ctx.globalCompositeOperation = 'destination-out';
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    var x = padding + j * scaleX;
                    var y = padding + (m - 1 - i) * scaleY;
                    var sizeX = scaleX + 1;
                    var sizeY = scaleY + 1;

                    ctx.fillRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                }
            }
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // Draw null region borders (optional)
    var strokeColor = nullRegion.stroke;
    var showStroke = nullRegion.showStroke !== undefined ? nullRegion.showStroke : true;
    if (strokeColor && showStroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = nullRegion.strokeWidth !== undefined ? nullRegion.strokeWidth : 1;
        ctx.setLineDash(nullRegion.strokeDash || []);

        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    var x = padding + j * scaleX;
                    var y = padding + (m - 1 - i) * scaleY;
                    var sizeX = scaleX + 1;
                    var sizeY = scaleY + 1;

                    ctx.strokeRect(x - sizeX / 2, y - sizeY / 2, sizeX, sizeY);
                }
            }
        }
        ctx.setLineDash([]);
    }

    // Restore context state
    ctx.restore();
}

module.exports = drawNulls;
