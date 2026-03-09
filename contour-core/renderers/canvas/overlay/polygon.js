'use strict';

/**
 * Polygon renderer for overlay
 */

/**
 * Render polygon items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} items - Array of polygon items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) {
        return;
    }

    items.forEach(function(item) {
        var points = item.points || [];
        if (points.length < 3) {
            return;
        }

        var options = item.options || {};

        // Default style
        var fillColor = options.fillColor || 'rgba(0, 255, 0, 0.3)';
        var strokeColor = options.strokeColor || '#00ff00';
        var strokeWidth = options.strokeWidth || 2;

        ctx.save();

        // Draw fill
        ctx.beginPath();
        var firstPoint = overlay._toCanvasCoords(points[0].x, points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (var i = 1; i < points.length; i++) {
            var coords = overlay._toCanvasCoords(points[i].x, points[i].y);
            ctx.lineTo(coords.x, coords.y);
        }

        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Draw stroke
        if (strokeWidth > 0) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }

        ctx.restore();
    });
}

module.exports = {
    render: render
};
