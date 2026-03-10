'use strict';

/**
 * Point drawing module
 * Supports multiple shapes, stroke, text labels
 */

var shapes = require('./shapes');
var textDrawer = require('./text');

var DEFAULTS = {
    size: 8,
    color: '#ff0000',
    strokeColor: null,
    strokeWidth: 0,
    shape: 'circle'
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
 * Draw custom image shape
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} size - Size
 * @param {Object} customShape - Custom shape config { svg, image }
 * @param {Function} callback - Callback when done
 */
function drawCustomImage(ctx, x, y, size, customShape, callback) {
    // Browser environment only
    if (typeof Image === 'undefined') {
        if (callback) callback();
        return;
    }

    var img = new Image();
    var src = customShape.svg || customShape.image;

    img.onload = function() {
        ctx.drawImage(img, x - size/2, y - size/2, size, size);
        if (callback) callback();
    };

    img.onerror = function() {
        // On load failure, draw default circle
        shapes.drawCircle(ctx, x, y, size);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        if (callback) callback();
    };

    img.src = src;
}

/**
 * Draw a single point
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Object} options - Point options
 * @param {Overlay} overlay - Overlay manager instance
 */
function drawPoint(ctx, x, y, options, overlay) {
    if (!ctx || x === null || y === null) return;

    var opts = mergeOptions(options);

    ctx.save();

    // Draw shape
    if (shapes.isCustomShape(opts.shape)) {
        // Custom shape (async)
        drawCustomImage(ctx, x, y, opts.size, opts.shape);
    } else {
        // Built-in shape
        var shapeDrawer = shapes.getShapeDrawer(opts.shape);
        shapeDrawer(ctx, x, y, opts.size);

        // Fill
        ctx.fillStyle = opts.color;
        ctx.fill();

        // Stroke (border)
        if (opts.strokeColor && opts.strokeWidth > 0) {
            ctx.strokeStyle = opts.strokeColor;
            ctx.lineWidth = opts.strokeWidth;
            ctx.stroke();
        }
    }

    ctx.restore();

    // Draw text label
    if (options.text && options.text.content) {
        var textOpts = options.text;
        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.size / 2 - 10;

        textDrawer.drawText(ctx, x + offsetX, y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
        }, overlay);
    }
}

/**
 * Render all points
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of point items
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var canvasPos = overlay._toCanvasCoords(item.x, item.y);

        // Skip invalid points
        if (!canvasPos) continue;

        drawPoint(ctx, canvasPos.x, canvasPos.y, item.options, overlay);
    }
}


module.exports = {
    render: render,
    drawPoint: drawPoint,
    DEFAULTS: DEFAULTS
};
