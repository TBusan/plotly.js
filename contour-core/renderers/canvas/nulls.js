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

    // Get visible range for coordinate transformation (interactive mode)
    var visibleRange = style.visibleRange;
    var fullRange = style.fullRange || visibleRange;

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    // Calculate drawing area
    var drawArea = {
        x: padding,
        y: padding,
        width: width - 2 * padding,
        height: height - 2 * padding
    };

    // Calculate scale based on visible range
    var scaleX, scaleY, offsetX, offsetY;

    if (visibleRange && fullRange) {
        // Interactive mode: scale based on visible range
        var xRange = visibleRange.xMax - visibleRange.xMin;
        var yRange = visibleRange.yMax - visibleRange.yMin;

        scaleX = drawArea.width / xRange;
        scaleY = drawArea.height / yRange;

        // Calculate offset to shift data coordinates to visible range
        offsetX = drawArea.x - (visibleRange.xMin - fullRange.xMin) * scaleX;
        offsetY = drawArea.y + drawArea.height + (visibleRange.yMin - fullRange.yMin) * scaleY;
    } else {
        // Static mode: use original calculation
        scaleX = drawArea.width / (n - 1);
        scaleY = drawArea.height / (m - 1);
        offsetX = drawArea.x;
        offsetY = drawArea.y + drawArea.height;
    }

    // Helper function to convert grid coordinates to canvas coordinates
    function gridToCanvas(j, i) {
        // j is column (x direction), i is row (y direction from top)
        // Canvas y is inverted (0 at top)
        var canvasX = offsetX + j * scaleX;
        var canvasY = offsetY - i * scaleY;
        return [canvasX, canvasY];
    }

    // Save context state
    ctx.save();

    // Fill null regions with background color to mask contours
    var fillColor = nullRegion.fill || nullRegion.bgColor || '#ffffff';
    if (fillColor !== 'transparent') {
        ctx.fillStyle = fillColor;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    var pt = gridToCanvas(j, i);
                    var x = pt[0];
                    var y = pt[1];
                    var sizeX = Math.abs(scaleX) + 1;
                    var sizeY = Math.abs(scaleY) + 1;

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
                    var pt = gridToCanvas(j, i);
                    var x = pt[0];
                    var y = pt[1];
                    var sizeX = Math.abs(scaleX) + 1;
                    var sizeY = Math.abs(scaleY) + 1;

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
                    var pt = gridToCanvas(j, i);
                    var x = pt[0];
                    var y = pt[1];
                    var sizeX = Math.abs(scaleX) + 1;
                    var sizeY = Math.abs(scaleY) + 1;

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
