'use strict';

/**
 * Heatmap background rendering for contours
 * Supports 'heatmap' coloring mode
 */

var colors = require('../../colorbar/colors');

// Detect environment and get canvas factory
var isNodeJS = typeof window === 'undefined' || typeof document === 'undefined';
var createCanvasElement;

if (isNodeJS) {
    try {
        createCanvasElement = require('@napi-rs/canvas').createCanvas;
    } catch (e) {
        // Fallback: create a mock that throws a helpful error
        createCanvasElement = function(width, height) {
            throw new Error('Canvas rendering in Node.js requires @napi-rs/canvas. Install it with: npm install @napi-rs/canvas');
        };
    }
} else {
    createCanvasElement = function(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };
}

/**
 * Draw heatmap background
 * Renders each grid cell with its corresponding color
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @param {string|Array} style.colorscale - Color scale
 * @param {number} style.width - Canvas width
 * @param {number} style.height - Canvas height
 * @param {number} style.padding - Padding around plot
 * @param {boolean} style.reverse - Reverse colorscale
 * @param {Object} style.dataRange - Data range {min, max}
 */
function drawHeatmapBackground(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    // Save context state to prevent pollution
    ctx.save();

    var z = grid.z;
    var m = z.length;    // number of rows
    var n = z[0].length; // number of columns

    if (m === 0 || n === 0) {
        ctx.restore();
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    var cellWidth = plotWidth / (n - 1);
    var cellHeight = plotHeight / (m - 1);

    // Get colorscale
    var colorscale = style.colorscale || 'Viridis';

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        // Calculate from data (excluding NaN/null values)
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                var val = z[i][j];
                if (typeof val === 'number' && isFinite(val)) {
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        }
        zmin = minVal;
        zmax = maxVal;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        ctx.restore();
        return; // No valid data
    }

    // Draw each cell
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];

            // Skip null/NaN values
            if (typeof value !== 'number' || !isFinite(value)) {
                continue;
            }

            // Get color for this cell
            var color = colors.mapColors(
                value,
                zmin,
                zmax,
                colorscale,
                {
                    reverse: style.reverse,
                    dataMin: style.dataRange ? style.dataRange.min : undefined,
                    dataMax: style.dataRange ? style.dataRange.max : undefined
                }
            );

            // Calculate cell position
            // Note: y is inverted (0 at top in canvas, but at bottom in grid)
            var x = padding + j * cellWidth;
            var y = padding + (m - 1 - i) * cellHeight;

            // Draw cell (slightly overlap to avoid gaps)
            ctx.fillStyle = color;
            ctx.fillRect(
                x - cellWidth / 2,
                y - cellHeight / 2,
                cellWidth + 1,  // +1 to overlap slightly
                cellHeight + 1
            );
        }
    }

    ctx.restore();
}

/**
 * Draw heatmap with interpolated cells
 * More accurate but slower version that interpolates colors at cell centers
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 */
function drawInterpolatedHeatmap(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        var minVal = Infinity;
        var maxVal = -Infinity;
        for (var i = 0; i < m; i++) {
            for (var j = 0; j < n; j++) {
                var val = z[i][j];
                if (typeof val === 'number' && isFinite(val)) {
                    if (val < minVal) minVal = val;
                    if (val > maxVal) maxVal = val;
                }
            }
        }
        zmin = minVal;
        zmax = maxVal;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return;
    }

    var colorscale = style.colorscale || 'Viridis';

    // Create an offscreen canvas for the heatmap
    var heatmapCanvas = document.createElement('canvas');
    heatmapCanvas.width = n;
    heatmapCanvas.height = m;
    var heatmapCtx = heatmapCanvas.getContext('2d');
    var imageData = heatmapCtx.createImageData(n, m);

    // Fill pixel data
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];
            var pixelIndex = (i * n + j) * 4;

            if (typeof value === 'number' && isFinite(value)) {
                var color = colors.mapColors(
                    value,
                    zmin,
                    zmax,
                    colorscale,
                    {
                        reverse: style.reverse
                    }
                );

                // Parse hex color
                var r = parseInt(color.slice(1, 3), 16);
                var g = parseInt(color.slice(3, 5), 16);
                var b = parseInt(color.slice(5, 7), 16);

                imageData.data[pixelIndex] = r;
                imageData.data[pixelIndex + 1] = g;
                imageData.data[pixelIndex + 2] = b;
                imageData.data[pixelIndex + 3] = 255; // Alpha
            } else {
                // Transparent for null/NaN values
                imageData.data[pixelIndex + 3] = 0;
            }
        }
    }

    heatmapCtx.putImageData(imageData, 0, 0);

    // Draw scaled to main canvas
    ctx.save();
    ctx.translate(padding, padding);
    ctx.scale(plotWidth / n, plotHeight / m);
    ctx.translate(0, m);
    ctx.scale(1, -1);
    ctx.drawImage(heatmapCanvas, 0, 0);
    ctx.restore();
}

/**
 * Draw heatmap with bicubic interpolation
 * Smoothest but slowest - uses bicubic interpolation
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 */
function drawSmoothHeatmap(ctx, grid, style) {
    if (!grid || !grid.z || !ctx) {
        return;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return;
    }

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Create high-resolution offscreen canvas
    var scaleFactor = Math.max(1, Math.min(10, Math.ceil(100 / Math.max(n, m))));
    var hiresCanvas = createCanvasElement(n * scaleFactor, m * scaleFactor);
    var hiresCtx = hiresCanvas.getContext('2d');

    // Draw interpolated heatmap at high resolution
    drawInterpolatedHeatmap(hiresCtx, grid, {
        width: hiresCanvas.width,
        height: hiresCanvas.height,
        padding: 0,
        colorscale: style.colorscale,
        dataRange: style.dataRange,
        reverse: style.reverse
    });

    // Enable smoothing for high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Draw scaled down to main canvas with smoothing
    ctx.save();
    ctx.translate(padding, padding);
    ctx.scale(plotWidth / hiresCanvas.width, plotHeight / hiresCanvas.height);
    ctx.translate(0, hiresCanvas.height);
    ctx.scale(1, -1);
    ctx.drawImage(hiresCanvas, 0, 0);
    ctx.restore();
}

module.exports = {
    drawHeatmapBackground: drawHeatmapBackground,
    drawInterpolatedHeatmap: drawInterpolatedHeatmap,
    drawSmoothHeatmap: drawSmoothHeatmap
};
