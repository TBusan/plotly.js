'use strict';

/**
 * Text renderer for overlay
 * 使用 CoordSystem 进行坐标转换
 */

var DEFAULT_OPTIONS = {
    fontSize: 12,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    color: '#000000',
    rotation: 0,
    align: 'center',
    baseline: 'middle',
    background: null
};

function mergeOptions(userOptions) {
    if (!userOptions) {
        return Object.assign({}, DEFAULT_OPTIONS);
    }
    return Object.assign({}, DEFAULT_OPTIONS, userOptions);
}

function buildFontString(options) {
    var fontWeight = options.fontWeight || 'normal';
    var fontSize = options.fontSize || 12;
    var fontFamily = options.fontFamily || 'Arial';
    return fontWeight + ' ' + fontSize + 'px ' + fontFamily;
}

function drawBackground(ctx, x, y, text, options) {
    if (!options.background) {
        return;
    }

    var padding = 2;
    var metrics = ctx.measureText(text);
    var textWidth = metrics.width;
    var textHeight = options.fontSize || 12;

    var boxX = x;
    var boxY = y;

    if (options.align === 'center') {
        boxX = x - textWidth / 2;
    } else if (options.align === 'right') {
        boxX = x - textWidth;
    }

    if (options.baseline === 'middle') {
        boxY = y - textHeight / 2;
    } else if (options.baseline === 'bottom') {
        boxY = y - textHeight;
    }

    ctx.fillStyle = options.background;
    ctx.fillRect(
        boxX - padding,
        boxY - padding,
        textWidth + padding * 2,
        textHeight + padding * 2
    );
}

/**
 * Render text items
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} items - Array of text items
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function render(ctx, items, coordSystem) {
    if (!items || items.length === 0) {
        return;
    }

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var coords = coordSystem.toCanvas(item.x, item.y);

        if (!coords) continue;

        var options = mergeOptions(item.options);

        ctx.save();

        var fontString = buildFontString(options);
        ctx.font = fontString;
        ctx.fillStyle = options.color;
        ctx.textAlign = options.align;
        ctx.textBaseline = options.baseline;

        if (options.rotation !== 0) {
            ctx.translate(coords.x, coords.y);
            ctx.rotate(options.rotation);
            ctx.translate(-coords.x, -coords.y);
        }

        drawBackground(ctx, coords.x, coords.y, item.content, options);
        ctx.fillText(item.content, coords.x, coords.y);

        ctx.restore();
    }
}

/**
 * Draw text at specified position (for use by other renderers)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - X coordinate (canvas coordinates)
 * @param {number} y - Y coordinate (canvas coordinates)
 * @param {string} content - Text content
 * @param {Object} options - Text options
 */
function drawText(ctx, x, y, content, options) {
    if (!content) return;

    var opts = mergeOptions(options);

    ctx.save();

    ctx.font = buildFontString(opts);
    ctx.fillStyle = opts.color;
    ctx.textAlign = opts.align;
    ctx.textBaseline = opts.baseline;

    ctx.translate(x, y);
    if (opts.rotation) {
        ctx.rotate(opts.rotation);
    }

    if (opts.background) {
        var metrics = ctx.measureText(content);
        var bgWidth = metrics.width + 6;
        var bgHeight = opts.fontSize + 4;
        ctx.fillStyle = opts.background;

        var bgX = 0;
        var bgY = 0;
        if (opts.align === 'center') {
            bgX = -bgWidth / 2;
        } else if (opts.align === 'right') {
            bgX = -bgWidth;
        }
        if (opts.baseline === 'middle') {
            bgY = -bgHeight / 2;
        } else if (opts.baseline === 'bottom') {
            bgY = -bgHeight;
        }

        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        ctx.fillStyle = opts.color;
    }

    ctx.fillText(content, 0, 0);
    ctx.restore();
}

module.exports = {
    DEFAULT_OPTIONS: DEFAULT_OPTIONS,
    mergeOptions: mergeOptions,
    render: render,
    drawText: drawText
};
