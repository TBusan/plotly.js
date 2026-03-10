'use strict';

/**
 * Line drawing module
 * Supports line styles (solid, dashed, dotted) and text labels
 */

var textDrawer = require('./text');

var DEFAULTS = {
    color: '#000000',
    width: 1,
    style: 'solid',
    cap: 'round',
    join: 'round'
};

/**
 * Merge options with defaults
 * @param {Object} options - User provided options
 * @returns {Object} Merged options
 */
function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

/**
 * Set line style based on type
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} style - Line style ('solid', 'dashed', 'dotted')
 * @param {number} width - Line width
 */
function setLineStyle(ctx, style, width) {
    switch (style) {
        case 'dashed':
            ctx.setLineDash([width * 3, width * 2]);
            break;
        case 'dotted':
            ctx.setLineDash([width, width * 2]);
            break;
        default:
            ctx.setLineDash([]);
    }
}

/**
 * Calculate angle at a point along a path
 * @param {Array} points - Array of canvas coordinates
 * @param {number} index - Point index
 * @returns {number} Angle in radians
 */
function getAngleAtPoint(points, index) {
    var prev = Math.max(0, index - 1);
    var next = Math.min(points.length - 1, index + 1);
    var dx = points[next].x - points[prev].x;
    var dy = points[next].y - points[prev].y;
    return Math.atan2(dy, dx);
}

/**
 * Get point at specified position along the line
 * @param {Array} points - Array of canvas coordinates
 * @param {string|number} position - Position ('start', 'middle', 'end', or index)
 * @returns {Object} { index, point }
 */
function getPointAtPosition(points, position) {
    if (position === 'start') {
        return { index: 0, point: points[0] };
    }
    if (position === 'end') {
        return { index: points.length - 1, point: points[points.length - 1] };
    }
    if (position === 'middle' || typeof position === 'undefined') {
        var midIndex = Math.floor(points.length / 2);
        return { index: midIndex, point: points[midIndex] };
    }
    // Numeric index
    var idx = Math.min(Math.max(0, position), points.length - 1);
    return { index: idx, point: points[idx] };
}

/**
 * Draw a single line
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} points - Array of {x, y} data coordinates
 * @param {Object} options - Line options
 * @param {Overlay} overlay - Overlay manager instance
 */
function drawLine(ctx, points, options, overlay) {
    if (!points || points.length < 2) return;

    var opts = mergeOptions(options);

    ctx.save();

    // Convert coordinates
    var canvasPoints = [];
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var canvasPos = overlay._toCanvasCoords(p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1]);
        if (canvasPos) {
            canvasPoints.push(canvasPos);
        }
    }

    if (canvasPoints.length < 2) {
        ctx.restore();
        return;
    }

    // Set style
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = opts.width;
    ctx.lineCap = opts.cap;
    ctx.lineJoin = opts.join;
    setLineStyle(ctx, opts.style, opts.width);

    // Draw path
    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var i = 1; i < canvasPoints.length; i++) {
        ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.stroke();

    ctx.restore();

    // Draw text label
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var posInfo = getPointAtPosition(canvasPoints, textOpts.position);
        var angle = textOpts.rotation === 'auto'
            ? getAngleAtPoint(canvasPoints, posInfo.index)
            : (textOpts.rotation || 0);

        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.width - 10;

        // Calculate perpendicular offset
        var perpAngle = angle + Math.PI / 2;
        var perpOffsetX = Math.cos(perpAngle) * Math.abs(offsetY);
        var perpOffsetY = Math.sin(perpAngle) * Math.abs(offsetY);

        ctx.save();
        ctx.translate(posInfo.point.x + perpOffsetX + offsetX, posInfo.point.y + perpOffsetY);
        ctx.rotate(angle);

        textDrawer.drawText(ctx, 0, 0, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background,
            align: 'center',
            baseline: 'middle'
        }, overlay);

        ctx.restore();
    }
}

/**
 * Render all lines
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of line items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawLine(ctx, item.points, item.options, overlay);
    }
}

module.exports = {
    render: render,
    drawLine: drawLine,
    DEFAULTS: DEFAULTS
};
