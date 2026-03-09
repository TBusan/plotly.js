'use strict';

/**
 * Text renderer for overlay
 */

/**
 * Render text items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} items - Array of text items
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
        var font = options.font || '12px Arial';
        var color = options.color || '#000000';
        var align = options.align || 'left';
        var baseline = options.baseline || 'top';

        ctx.save();
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;

        ctx.fillText(item.content, coords.x, coords.y);
        ctx.restore();
    });
}

module.exports = {
    render: render
};
