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

    // Get data coordinate arrays
    var xData = style.x || [];
    var yData = style.y || [];

    // Get visible range for coordinate transformation (interactive mode)
    var visibleRange = style.visibleRange;

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

    // Determine coordinate range for transformation
    var xMin, xMax, yMin, yMax;
    if (visibleRange) {
        // Interactive mode: use visible range (in data coordinates)
        xMin = visibleRange.xMin;
        xMax = visibleRange.xMax;
        yMin = visibleRange.yMin;
        yMax = visibleRange.yMax;
    } else {
        // Static mode: use full data range
        xMin = xData.length > 0 ? Math.min.apply(Math, xData) : 0;
        xMax = xData.length > 0 ? Math.max.apply(Math, xData) : n - 1;
        yMin = yData.length > 0 ? Math.min.apply(Math, yData) : 0;
        yMax = yData.length > 0 ? Math.max.apply(Math, yData) : m - 1;
    }

    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    // Helper function to convert DATA coordinates to canvas coordinates
    // Uses the same formula as scalePoint in paths.js for consistency
    function dataToCanvas(dataX, dataY) {
        var canvasX = drawArea.x + ((dataX - xMin) / xRange) * drawArea.width;
        var canvasY = drawArea.y + drawArea.height - ((dataY - yMin) / yRange) * drawArea.height;
        return [canvasX, canvasY];
    }

    // Get data coordinate for grid index
    function getXCoord(j) {
        return xData.length > j ? xData[j] : j;
    }

    function getYCoord(i) {
        return yData.length > i ? yData[i] : i;
    }

    // Calculate cell size in canvas coordinates
    var cellSizeX, cellSizeY;
    if (xData.length >= 2) {
        cellSizeX = Math.abs(dataToCanvas(xData[1], 0)[0] - dataToCanvas(xData[0], 0)[0]);
    } else {
        cellSizeX = drawArea.width / (n - 1);
    }
    if (yData.length >= 2) {
        cellSizeY = Math.abs(dataToCanvas(0, yData[1])[1] - dataToCanvas(0, yData[0])[1]);
    } else {
        cellSizeY = drawArea.height / (m - 1);
    }

    // Ensure minimum cell size
    cellSizeX = Math.max(cellSizeX, 1);
    cellSizeY = Math.max(cellSizeY, 1);

    // Save context state
    ctx.save();

    // Fill null regions with background color to mask contours
    var fillColor = nullRegion.fill || nullRegion.bgColor || '#ffffff';
    if (fillColor !== 'transparent') {
        ctx.fillStyle = fillColor;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    // Convert grid indices to data coordinates
                    var dataX = getXCoord(j);
                    var dataY = getYCoord(i);
                    var pt = dataToCanvas(dataX, dataY);

                    ctx.fillRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
                }
            }
        }
    } else {
        // Use destination-out to make null regions transparent
        ctx.globalCompositeOperation = 'destination-out';
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                if (nullMask[i][j]) {
                    var dataX = getXCoord(j);
                    var dataY = getYCoord(i);
                    var pt = dataToCanvas(dataX, dataY);

                    ctx.fillRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
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
                    var dataX = getXCoord(j);
                    var dataY = getYCoord(i);
                    var pt = dataToCanvas(dataX, dataY);

                    ctx.strokeRect(pt[0] - cellSizeX / 2, pt[1] - cellSizeY / 2, cellSizeX, cellSizeY);
                }
            }
        }
        ctx.setLineDash([]);
    }

    // Restore context state
    ctx.restore();
}

module.exports = drawNulls;
