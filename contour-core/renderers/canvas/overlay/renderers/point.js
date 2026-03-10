'use strict';

/**
 * Point drawing module
 * 使用 CoordSystem 进行坐标转换
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

function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options && options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

function drawCustomImage(ctx, x, y, size, customShape, callback) {
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
 * @param {number} x - X coordinate (canvas coordinates)
 * @param {number} y - Y coordinate (canvas coordinates)
 * @param {Object} options - Point options
 */
function drawPoint(ctx, x, y, options) {
    if (!ctx || x === null || y === null) return;

    var opts = mergeOptions(options);

    ctx.save();

    if (shapes.isCustomShape(opts.shape)) {
        drawCustomImage(ctx, x, y, opts.size, opts.shape);
    } else {
        var shapeDrawer = shapes.getShapeDrawer(opts.shape);
        shapeDrawer(ctx, x, y, opts.size);

        ctx.fillStyle = opts.color;
        ctx.fill();

        if (opts.strokeColor && opts.strokeWidth > 0) {
            ctx.strokeStyle = opts.strokeColor;
            ctx.lineWidth = opts.strokeWidth;
            ctx.stroke();
        }
    }

    ctx.restore();

    // Draw text label
    if (options && options.text && options.text.content) {
        var textOpts = options.text;
        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.size / 2 - 10;

        textDrawer.drawText(ctx, x + offsetX, y + offsetY, textOpts.content, {
            fontSize: textOpts.fontSize,
            fontFamily: textOpts.fontFamily,
            fontWeight: textOpts.fontWeight,
            color: textOpts.color,
            background: textOpts.background
        });
    }
}

/**
 * Render all points
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of point items
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function render(ctx, items, coordSystem) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var canvasPos = coordSystem.toCanvas(item.x, item.y);

        if (!canvasPos) continue;

        drawPoint(ctx, canvasPos.x, canvasPos.y, item.options);
    }
}

module.exports = {
    render: render,
    drawPoint: drawPoint,
    DEFAULTS: DEFAULTS
};
