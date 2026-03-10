'use strict';

/**
 * Canvas colorbar drawing
 */

var mapColors = require('../../colorbar').mapColors;
var computeTicks = require('../../colorbar').computeTicks;

/**
 * Draw colorbar on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} contourResult - Contour result
 * @param {Object} style - Style options
 */
function drawColorbar(ctx, contourResult, style) {
    style = style || {};

    var levels = contourResult.levels;
    if (!levels || levels.length === 0) return;

    // Save context state to prevent pollution
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

    // Restore context state
    ctx.restore();
}

module.exports = drawColorbar;
