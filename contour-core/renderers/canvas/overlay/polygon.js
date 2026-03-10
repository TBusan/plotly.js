'use strict';

/**
 * Polygon drawing module
 * Supports fill patterns, stroke, and text labels
 */

var patterns = require('./patterns');
var textDrawer = require('./text');

var DEFAULT_FILL = {
    type: 'color',
    color: 'rgba(0, 0, 0, 0.3)'
};

var DEFAULT_STROKE = {
    color: '#000000',
    width: 1,
    style: 'solid'
};

/**
 * Calculate center point of polygon
 * @param {Array} points - Array of {x, y} points
 * @returns {Object} Center point {x, y}
 */
function calculateCenter(points) {
    if (!points || points.length === 0) {
        return { x: 0, y: 0 };
    }

    var sumX = 0, sumY = 0;
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        sumX += p.x !== undefined ? p.x : p[0];
        sumY += p.y !== undefined ? p.y : p[1];
    }

    return {
        x: sumX / points.length,
        y: sumY / points.length
    };
}

/**
 * Draw a single polygon
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} points - Array of {x, y} data coordinates
 * @param {Object} options - Polygon options
 * @param {Overlay} overlay - Overlay manager instance
 */
function drawPolygon(ctx, points, options, overlay) {
    if (!points || points.length < 3) return;

    options = options || {};

    // Convert coordinates
    var canvasPoints = [];
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var canvasPos = overlay._toCanvasCoords(p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1]);
        if (canvasPos) {
            canvasPoints.push(canvasPos);
        }
    }

    if (canvasPoints.length < 3) {
        return;
    }

    ctx.save();

    // Draw path
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.closePath();

    // Fill
    var fill = options.fill || DEFAULT_FILL;
    if (fill.type === 'pattern') {
        var pattern = patterns.getPattern(fill, ctx);
        if (pattern) {
            ctx.fillStyle = pattern;
        } else {
            ctx.fillStyle = fill.color || DEFAULT_FILL.color;
        }
    } else {
        ctx.fillStyle = fill.color || DEFAULT_FILL.color;
    }
    ctx.fill();

    // Stroke (border)
    var stroke = options.stroke;
    if (stroke && stroke.color) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width || DEFAULT_STROKE.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Line style
        switch (stroke.style) {
            case 'dashed':
                ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
                break;
            case 'dotted':
                ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 2]);
                break;
            default:
                ctx.setLineDash([]);
        }

        ctx.stroke();
    }

    ctx.restore();

    // Draw text label
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var center;

        if (textOpts.position === 'center' || !textOpts.position) {
            center = calculateCenter(canvasPoints);
        } else if (Array.isArray(textOpts.position)) {
            center = overlay._toCanvasCoords(textOpts.position[0], textOpts.position[1]);
        } else {
            center = calculateCenter(canvasPoints);
        }

        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : 0;

        textDrawer.drawText(ctx, center.x + offsetX, center.y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
        }, overlay);
    }
}

/**
 * Render all polygons
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of polygon items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawPolygon(ctx, item.points, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawPolygon: drawPolygon,
    calculateCenter: calculateCenter,
    DEFAULT_FILL: DEFAULT_FILL,
    DEFAULT_STROKE: DEFAULT_STROKE
};
