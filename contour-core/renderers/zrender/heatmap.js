'use strict';

/**
 * ZRender heatmap background rendering for contours
 * Supports 'heatmap' coloring mode using zrender elements
 */

var zrender = require('zrender');
var colors = require('../../colorbar/colors');

/**
 * Create heatmap background as zrender elements
 * Renders each grid cell with its corresponding color using Rect elements
 * Best for small grids or when individual cell interaction is needed
 *
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @returns {zrender.Group} Group containing heatmap elements
 */
function createHeatmapBackground(grid, style) {
    style = style || {};

    var group = new zrender.Group();

    if (!grid || !grid.z) {
        return group;
    }

    var z = grid.z;
    var m = z.length;    // number of rows
    var n = z[0].length; // number of columns

    if (m === 0 || n === 0) {
        return group;
    }

    var width = style.width || 500;
    var height = style.height || 400;
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
        var range = calculateDataRange(z, m, n);
        zmin = range.min;
        zmax = range.max;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return group; // No valid data
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

            // Create cell rectangle (slightly overlap to avoid gaps)
            var rect = new zrender.Rect({
                shape: {
                    x: x - cellWidth / 2,
                    y: y - cellHeight / 2,
                    width: cellWidth + 1,  // +1 to overlap slightly
                    height: cellHeight + 1
                },
                style: {
                    fill: color,
                    stroke: 'none'
                },
                silent: true,
                z: 0
            });

            group.add(rect);
        }
    }

    return group;
}

/**
 * Create heatmap with interpolated cells using offscreen canvas
 * More accurate and performant for large grids
 *
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @returns {zrender.Image|null} Image element or null
 */
function createInterpolatedHeatmap(grid, style) {
    style = style || {};

    if (!grid || !grid.z) {
        return null;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        var range = calculateDataRange(z, m, n);
        zmin = range.min;
        zmax = range.max;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return null;
    }

    var colorscale = style.colorscale || 'Viridis';

    // Create offscreen canvas for the heatmap
    var heatmapCanvas = createOffscreenCanvas(n, m);
    if (!heatmapCanvas) {
        // Fallback to non-canvas method if document is not available
        return createHeatmapBackground(grid, style);
    }

    var heatmapCtx = heatmapCanvas.getContext('2d');
    var imageData = heatmapCtx.createImageData(n, m);

    // Fill pixel data
    // Note: Canvas pixel data goes from top to bottom, but grid data goes from bottom to top
    // So we flip the Y axis by reversing the row order
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {
            var value = z[i][j];
            // Flip Y: row i in grid data becomes row (m-1-i) in canvas pixel data
            var pixelIndex = ((m - 1 - i) * n + j) * 4;

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
                var rgb = parseHexColor(color);
                imageData.data[pixelIndex] = rgb.r;
                imageData.data[pixelIndex + 1] = rgb.g;
                imageData.data[pixelIndex + 2] = rgb.b;
                imageData.data[pixelIndex + 3] = 255; // Alpha
            } else {
                // Transparent for null/NaN values
                imageData.data[pixelIndex + 3] = 0;
            }
        }
    }

    heatmapCtx.putImageData(imageData, 0, 0);

    // Create zrender Image element
    return new zrender.Image({
        style: {
            x: padding,
            y: padding,
            width: plotWidth,
            height: plotHeight,
            image: heatmapCanvas
        },
        silent: true,
        z: 0
    });
}

/**
 * Create heatmap with smooth interpolation
 * Uses higher resolution canvas with browser smoothing
 *
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @returns {zrender.Image|null} Image element or null
 */
function createSmoothHeatmap(grid, style) {
    style = style || {};

    if (!grid || !grid.z) {
        return null;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Calculate scale factor for high-resolution rendering
    var scaleFactor = Math.max(1, Math.min(10, Math.ceil(100 / Math.max(n, m))));

    // Create high-resolution offscreen canvas
    var hiresCanvas = createOffscreenCanvas(n * scaleFactor, m * scaleFactor);
    if (!hiresCanvas) {
        // Fallback to interpolated heatmap
        return createInterpolatedHeatmap(grid, style);
    }

    var hiresCtx = hiresCanvas.getContext('2d');

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        var range = calculateDataRange(z, m, n);
        zmin = range.min;
        zmax = range.max;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return null;
    }

    var colorscale = style.colorscale || 'Viridis';

    // Fill high-resolution pixel data with interpolation
    var imageData = hiresCtx.createImageData(n * scaleFactor, m * scaleFactor);
    var totalRows = m * scaleFactor;

    for (var i = 0; i < m * scaleFactor; i++) {
        for (var j = 0; j < n * scaleFactor; j++) {
            // Map to original grid coordinates
            var gridI = i / scaleFactor;
            var gridJ = j / scaleFactor;

            // Bilinear interpolation
            var value = interpolateValue(z, m, n, gridI, gridJ);

            // Flip Y: row i becomes row (totalRows-1-i) in canvas pixel data
            var pixelIndex = ((totalRows - 1 - i) * n * scaleFactor + j) * 4;

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

                var rgb = parseHexColor(color);
                imageData.data[pixelIndex] = rgb.r;
                imageData.data[pixelIndex + 1] = rgb.g;
                imageData.data[pixelIndex + 2] = rgb.b;
                imageData.data[pixelIndex + 3] = 255;
            } else {
                imageData.data[pixelIndex + 3] = 0;
            }
        }
    }

    hiresCtx.putImageData(imageData, 0, 0);

    // Create zrender Image element
    return new zrender.Image({
        style: {
            x: padding,
            y: padding,
            width: plotWidth,
            height: plotHeight,
            image: hiresCanvas
        },
        silent: true,
        z: 0
    });
}

/**
 * Create heatmap with bicubic interpolation for smoothest result
 * Best quality but slowest performance
 *
 * @param {Object} grid - Grid data {z, x, y}
 * @param {Object} style - Style options
 * @returns {zrender.Image|null} Image element or null
 */
function createBicubicHeatmap(grid, style) {
    style = style || {};

    if (!grid || !grid.z) {
        return null;
    }

    var z = grid.z;
    var m = z.length;
    var n = z[0].length;

    if (m === 0 || n === 0) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;
    var plotWidth = width - 2 * padding;
    var plotHeight = height - 2 * padding;

    // Use higher resolution for bicubic
    var scaleFactor = Math.max(2, Math.min(10, Math.ceil(200 / Math.max(n, m))));

    // Create high-resolution offscreen canvas
    var hiresCanvas = createOffscreenCanvas(n * scaleFactor, m * scaleFactor);
    if (!hiresCanvas) {
        return createSmoothHeatmap(grid, style);
    }

    var hiresCtx = hiresCanvas.getContext('2d');

    // Determine data range
    var zmin, zmax;
    if (style.dataRange && style.dataRange.min !== undefined) {
        zmin = style.dataRange.min;
        zmax = style.dataRange.max;
    } else {
        var range = calculateDataRange(z, m, n);
        zmin = range.min;
        zmax = range.max;
    }

    if (!isFinite(zmin) || !isFinite(zmax)) {
        return null;
    }

    var colorscale = style.colorscale || 'Viridis';
    var imageData = hiresCtx.createImageData(n * scaleFactor, m * scaleFactor);
    var totalRows = m * scaleFactor;

    for (var i = 0; i < m * scaleFactor; i++) {
        for (var j = 0; j < n * scaleFactor; j++) {
            var gridI = i / scaleFactor;
            var gridJ = j / scaleFactor;

            // Bicubic interpolation
            var value = bicubicInterpolate(z, m, n, gridI, gridJ);

            // Flip Y: row i becomes row (totalRows-1-i) in canvas pixel data
            var pixelIndex = ((totalRows - 1 - i) * n * scaleFactor + j) * 4;

            if (typeof value === 'number' && isFinite(value)) {
                var color = colors.mapColors(value, zmin, zmax, colorscale, { reverse: style.reverse });
                var rgb = parseHexColor(color);
                imageData.data[pixelIndex] = rgb.r;
                imageData.data[pixelIndex + 1] = rgb.g;
                imageData.data[pixelIndex + 2] = rgb.b;
                imageData.data[pixelIndex + 3] = 255;
            } else {
                imageData.data[pixelIndex + 3] = 0;
            }
        }
    }

    hiresCtx.putImageData(imageData, 0, 0);

    return new zrender.Image({
        style: {
            x: padding,
            y: padding,
            width: plotWidth,
            height: plotHeight,
            image: hiresCanvas
        },
        silent: true,
        z: 0
    });
}

// ============== Helper Functions ==============

/**
 * Calculate data range from grid
 */
function calculateDataRange(z, m, n) {
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

    return { min: minVal, max: maxVal };
}

/**
 * Create offscreen canvas (works in browser and Node.js with canvas package)
 */
function createOffscreenCanvas(width, height) {
    // Try browser canvas first
    if (typeof document !== 'undefined' && document.createElement) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // Try node-canvas package
    try {
        var nodeCanvas = require('canvas');
        if (nodeCanvas && nodeCanvas.createCanvas) {
            return nodeCanvas.createCanvas(width, height);
        }
    } catch (e) {
        // canvas package not available
    }

    return null;
}

/**
 * Parse hex color to RGB
 */
function parseHexColor(hex) {
    if (!hex || typeof hex !== 'string') {
        return { r: 128, g: 128, b: 128 };
    }

    // Handle rgba format
    if (hex.startsWith('rgba')) {
        var match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return {
                r: parseInt(match[1], 10),
                g: parseInt(match[2], 10),
                b: parseInt(match[3], 10)
            };
        }
    }

    // Handle hex format
    if (hex.startsWith('#')) {
        hex = hex.slice(1);
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return {
            r: parseInt(hex.slice(0, 2), 16) || 0,
            g: parseInt(hex.slice(2, 4), 16) || 0,
            b: parseInt(hex.slice(4, 6), 16) || 0
        };
    }

    return { r: 128, g: 128, b: 128 };
}

/**
 * Bilinear interpolation
 */
function interpolateValue(z, m, n, i, j) {
    var i0 = Math.floor(i);
    var j0 = Math.floor(j);
    var i1 = Math.min(i0 + 1, m - 1);
    var j1 = Math.min(j0 + 1, n - 1);

    var di = i - i0;
    var dj = j - j0;

    var v00 = z[i0][j0];
    var v01 = z[i0][j1];
    var v10 = z[i1][j0];
    var v11 = z[i1][j1];

    // Check for null values
    var valid00 = typeof v00 === 'number' && isFinite(v00);
    var valid01 = typeof v01 === 'number' && isFinite(v01);
    var valid10 = typeof v10 === 'number' && isFinite(v10);
    var valid11 = typeof v11 === 'number' && isFinite(v11);

    // If all values are valid, do proper interpolation
    if (valid00 && valid01 && valid10 && valid11) {
        return v00 * (1 - di) * (1 - dj) +
               v10 * di * (1 - dj) +
               v01 * (1 - di) * dj +
               v11 * di * dj;
    }

    // Partial interpolation for mixed valid/invalid
    var sum = 0;
    var weight = 0;

    if (valid00) { sum += v00 * (1 - di) * (1 - dj); weight += (1 - di) * (1 - dj); }
    if (valid01) { sum += v01 * (1 - di) * dj; weight += (1 - di) * dj; }
    if (valid10) { sum += v10 * di * (1 - dj); weight += di * (1 - dj); }
    if (valid11) { sum += v11 * di * dj; weight += di * dj; }

    return weight > 0 ? sum / weight : NaN;
}

/**
 * Bicubic interpolation using Catmull-Rom spline
 */
function bicubicInterpolate(z, m, n, i, j) {
    var i0 = Math.floor(i);
    var j0 = Math.floor(j);

    // Get 4x4 neighborhood
    var values = [];
    for (var di = -1; di <= 2; di++) {
        values[di + 1] = [];
        for (var dj = -1; dj <= 2; dj++) {
            var ii = Math.max(0, Math.min(m - 1, i0 + di));
            var jj = Math.max(0, Math.min(n - 1, j0 + dj));
            var v = z[ii][jj];
            values[di + 1][dj + 1] = (typeof v === 'number' && isFinite(v)) ? v : NaN;
        }
    }

    var fi = i - i0;
    var fj = j - j0;

    // Interpolate along rows
    var rowValues = [];
    for (var row = 0; row < 4; row++) {
        rowValues[row] = cubicInterpolate1D(
            values[row][0], values[row][1], values[row][2], values[row][3], fj
        );
    }

    // Interpolate along column
    return cubicInterpolate1D(
        rowValues[0], rowValues[1], rowValues[2], rowValues[3], fi
    );
}

/**
 * 1D cubic interpolation (Catmull-Rom)
 */
function cubicInterpolate1D(v0, v1, v2, v3, t) {
    // Handle NaN values
    var valid0 = !isNaN(v0);
    var valid1 = !isNaN(v1);
    var valid2 = !isNaN(v2);
    var valid3 = !isNaN(v3);

    if (!valid1 && !valid2) return NaN;
    if (!valid1) return v2;
    if (!valid2) return v1;

    // Simple cubic interpolation for valid center values
    if (!valid0) v0 = v1;
    if (!valid3) v3 = v2;

    var t2 = t * t;
    var t3 = t2 * t;

    // Catmull-Rom coefficients
    var a0 = -0.5 * v0 + 1.5 * v1 - 1.5 * v2 + 0.5 * v3;
    var a1 = v0 - 2.5 * v1 + 2 * v2 - 0.5 * v3;
    var a2 = -0.5 * v0 + 0.5 * v2;
    var a3 = v1;

    return a0 * t3 + a1 * t2 + a2 * t + a3;
}

/**
 * Draw heatmap onto a zrender container
 * Convenience function that chooses the best method
 *
 * @param {zrender.Group} container - Container to add heatmap to
 * @param {Object} grid - Grid data
 * @param {Object} style - Style options
 * @param {string} style.heatmapMode - 'basic', 'interpolated', 'smooth', or 'bicubic'
 */
function drawHeatmap(container, grid, style) {
    style = style || {};

    var mode = style.heatmapMode || 'interpolated';
    var element = null;

    switch (mode) {
        case 'basic':
            element = createHeatmapBackground(grid, style);
            break;
        case 'bicubic':
            element = createBicubicHeatmap(grid, style);
            break;
        case 'smooth':
            element = createSmoothHeatmap(grid, style);
            break;
        case 'interpolated':
        default:
            element = createInterpolatedHeatmap(grid, style);
            break;
    }

    if (element) {
        container.add(element);
    }

    return element;
}

module.exports = {
    createHeatmapBackground: createHeatmapBackground,
    createInterpolatedHeatmap: createInterpolatedHeatmap,
    createSmoothHeatmap: createSmoothHeatmap,
    createBicubicHeatmap: createBicubicHeatmap,
    drawHeatmap: drawHeatmap,
    // Utilities
    calculateDataRange: calculateDataRange,
    parseHexColor: parseHexColor,
    interpolateValue: interpolateValue,
    bicubicInterpolate: bicubicInterpolate
};
