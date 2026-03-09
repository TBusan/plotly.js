'use strict';

/**
 * Point renderer for overlay
 */

/**
 * Render point items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} items - Array of point items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) {
        return;
    }

    items.forEach(function(item) {
        var coords = overlay._toCanvasCoords(item.x, item.y);
        var options = item.options || {};

        // Default style
        var color = options.color || '#ff0000';
        var size = options.size || 6;
        var shape = options.shape || 'circle';

        ctx.save();
        ctx.fillStyle = color;

        if (shape === 'circle') {
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, size, 0, Math.PI * 2);
            ctx.fill();
        } else if (shape === 'square') {
            ctx.fillRect(coords.x - size, coords.y - size, size * 2, size * 2);
        } else {
            // Default to circle
            ctx.beginPath();
            ctx.arc(coords.x, coords.y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    });
}

module.exports = {
    render: render
};
