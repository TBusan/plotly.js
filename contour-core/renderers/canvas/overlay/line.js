'use strict';

/**
 * Line renderer for overlay
 */

/**
 * Render line items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} items - Array of line items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) {
        return;
    }

    items.forEach(function(item) {
        var points = item.points || [];
        if (points.length < 2) {
            return;
        }

        var options = item.options || {};

        // Default style
        var color = options.color || '#0000ff';
        var width = options.width || 2;
        var dash = options.dash || [];

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        var firstPoint = overlay._toCanvasCoords(points[0].x, points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (var i = 1; i < points.length; i++) {
            var coords = overlay._toCanvasCoords(points[i].x, points[i].y);
            ctx.lineTo(coords.x, coords.y);
        }

        ctx.stroke();
        ctx.restore();
    });
}

module.exports = {
    render: render
};
