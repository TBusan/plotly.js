'use strict';

/**
 * Canvas colorbar drawing
 * Supports both discrete (color blocks) and gradient colorbar modes
 */

var colorbar = require('../../colorbar');
var mapColors = colorbar.mapColors;
var computeDiscreteColorbar = colorbar.computeDiscreteColorbar;
var calculateColorbarDimensions = colorbar.calculateColorbarDimensions;

/**
 * Draw colorbar on canvas
 * Auto-detects discrete mode if blocks format is provided
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawColorbar(ctx, contourResult, style) {
    style = style || {};

    // Check if discrete mode is requested or colorScale provides blocks
    var colorbarConfig = style.colorbar || {};
    var blocks = colorbarConfig.blocks || style.colorScale;

    if (blocks && Array.isArray(blocks) && blocks.length > 0 && Array.isArray(blocks[0])) {
        // Use discrete colorbar rendering
        drawDiscreteColorbar(ctx, blocks, style);
    } else {
        // Use legacy gradient colorbar rendering
        drawGradientColorbar(ctx, contourResult, style);
    }
}

/**
 * Draw discrete colorbar (color blocks)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} blocks - Array of [color, value] pairs
 * @param {Object} style - Style options
 */
function drawDiscreteColorbar(ctx, blocks, style) {
    style = style || {};
    var colorbarConfig = style.colorbar || {};

    ctx.save();

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var position = colorbarConfig.position || 'right';
    var thickness = colorbarConfig.thickness || 25;
    var padding = colorbarConfig.padding || 10;
    var tickInterval = colorbarConfig.tickInterval || 0;
    var blockGap = colorbarConfig.blockGap || 1;

    // Calculate dimensions
    var dims = calculateColorbarDimensions({
        position: position,
        thickness: thickness,
        padding: padding,
        width: width,
        height: height,
        blockCount: blocks.length
    });

    // Compute discrete colorbar data
    var discreteData = computeDiscreteColorbar(blocks, {
        tickInterval: tickInterval
    });

    // Draw each block
    for (var i = 0; i < discreteData.blocks.length; i++) {
        var block = discreteData.blocks[i];
        var bx, by, bw, bh;

        if (dims.isVertical) {
            bx = dims.x;
            by = dims.y + i * dims.blockThickness;
            bw = dims.thickness;
            bh = dims.blockThickness - blockGap;

            // Clamp block height
            if (by + bh > dims.y + dims.length) {
                bh = dims.y + dims.length - by;
            }
        } else {
            bx = dims.x + i * dims.blockThickness;
            by = dims.y;
            bw = dims.blockThickness - blockGap;
            bh = dims.thickness;

            // Clamp block width
            if (bx + bw > dims.x + dims.length) {
                bw = dims.x + dims.length - bx;
            }
        }

        // Draw block
        ctx.fillStyle = block.color;
        ctx.fillRect(bx, by, bw, bh);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    if (dims.isVertical) {
        ctx.strokeRect(dims.x, dims.y, dims.thickness, dims.length);
    } else {
        ctx.strokeRect(dims.x, dims.y, dims.length, dims.thickness);
    }

    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textBaseline = 'middle';

    for (var j = 0; j < discreteData.blocks.length; j++) {
        var block = discreteData.blocks[j];
        if (!block.showLabel) continue;

        var labelX, labelY;
        var label = formatValue(block.value);

        if (dims.isVertical) {
            labelX = dims.x + dims.thickness + 5;
            labelY = dims.y + j * dims.blockThickness + dims.blockThickness / 2;

            if (position === 'left') {
                ctx.textAlign = 'right';
                labelX = dims.x - 5;
            } else {
                ctx.textAlign = 'left';
            }
        } else {
            labelX = dims.x + j * dims.blockThickness + dims.blockThickness / 2;
            labelY = dims.y + dims.thickness + 12;

            if (position === 'top') {
                labelY = dims.y - 5;
            }
            ctx.textAlign = 'center';
        }

        ctx.fillText(label, labelX, labelY);
    }

    // Draw title if provided
    if (colorbarConfig.title) {
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';

        if (dims.isVertical) {
            ctx.save();
            ctx.translate(dims.x + dims.thickness / 2, dims.y - 15);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(colorbarConfig.title, 0, 0);
            ctx.restore();
        } else {
            ctx.fillText(colorbarConfig.title, dims.x + dims.length / 2, dims.y - 10);
        }
    }

    ctx.restore();
}

/**
 * Format value for display
 * @param {number} value - Value to format
 * @returns {string} Formatted value
 */
function formatValue(value) {
    if (Math.abs(value) < 0.01 || Math.abs(value) >= 1000) {
        return value.toExponential(1);
    }
    return value.toFixed(2);
}

/**
 * Draw gradient colorbar (legacy)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawGradientColorbar(ctx, contourResult, style) {
    style = style || {};

    var levels = contourResult.levels;
    if (!levels || levels.length === 0) return;

    ctx.save();

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;

    var thickness = style.colorbarThickness || 20;
    var len = style.colorbarLen || 0.8;
    var barHeight = height * len;
    var x = width - thickness - 10;
    var y = (height - barHeight) / 2;

    var colorscale = style.colorscale || 'Viridis';
    var zmin = style.zmin !== undefined ? style.zmin : levels[0];
    var zmax = style.zmax !== undefined ? style.zmax : levels[levels.length - 1];

    // Draw gradient
    for (var i = 0; i < barHeight; i++) {
        var t = 1 - i / barHeight;
        var value = zmin + t * (zmax - zmin);
        var color = mapColors(value, zmin, zmax, colorscale, style.reversescale);

        ctx.fillStyle = color;
        ctx.fillRect(x, y + i, thickness, 1);
    }

    // Draw border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, thickness, barHeight);

    // Draw title
    if (style.colorbarTitle) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.save();
        ctx.translate(x + thickness / 2, y - 10);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(style.colorbarTitle, 0, 0);
        ctx.restore();
    }

    // Draw tick labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var tickCount = Math.min(5, levels.length);
    for (i = 0; i < tickCount; i++) {
        var idx = Math.floor(i * (levels.length - 1) / (tickCount - 1));
        var level = levels[idx];
        var t = (level - levels[0]) / (levels[levels.length - 1] - levels[0]);
        var tickY = y + barHeight * (1 - t);

        ctx.fillText(level.toFixed(1), x + thickness + 5, tickY);
    }

    ctx.restore();
}

module.exports = drawColorbar;
