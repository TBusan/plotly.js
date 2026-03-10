'use strict';

/**
 * Text renderer for overlay
 */

/**
 * Default text options
 * @type {Object}
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

/**
 * Merge user options with defaults
 * @param {Object} userOptions - User provided options
 * @returns {Object} Merged options
 */
function mergeOptions(userOptions) {
    if (!userOptions) {
        return Object.assign({}, DEFAULT_OPTIONS);
    }
    return Object.assign({}, DEFAULT_OPTIONS, userOptions);
}

/**
 * Build font string from options
 * @param {Object} options - Text options
 * @returns {string} CSS font string
 */
function buildFontString(options) {
    var fontWeight = options.fontWeight || 'normal';
    var fontSize = options.fontSize || 12;
    var fontFamily = options.fontFamily || 'Arial';
    return fontWeight + ' ' + fontSize + 'px ' + fontFamily;
}

/**
 * Draw background for text
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Text content
 * @param {Object} options - Text options
 */
function drawBackground(ctx, x, y, text, options) {
    if (!options.background) {
        return;
    }

    var padding = 2;
    var metrics = ctx.measureText(text);
    var textWidth = metrics.width;
    var textHeight = options.fontSize || 12;

    // Calculate background box position based on alignment
    var boxX = x;
    var boxY = y;

    // Horizontal alignment
    if (options.align === 'center') {
        boxX = x - textWidth / 2;
    } else if (options.align === 'right') {
        boxX = x - textWidth;
    }

    // Vertical alignment
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
 * @param {Overlay} overlay - Overlay manager instance
 */
function render(ctx, items, overlay) {
    if (!items || items.length === 0) {
        return;
    }

    items.forEach(function(item) {
        var coords = overlay._toCanvasCoords(item.x, item.y);
        var options = mergeOptions(item.options);

        ctx.save();

        // Build and set font
        var fontString = buildFontString(options);
        ctx.font = fontString;
        ctx.fillStyle = options.color;
        ctx.textAlign = options.align;
        ctx.textBaseline = options.baseline;

        // Apply rotation if needed
        if (options.rotation !== 0) {
            ctx.translate(coords.x, coords.y);
            ctx.rotate(options.rotation);
            ctx.translate(-coords.x, -coords.y);
        }

        // Draw background first (behind text)
        drawBackground(ctx, coords.x, coords.y, item.content, options);

        // Draw text
        ctx.fillText(item.content, coords.x, coords.y);

        ctx.restore();
    });
}

/**
 * Draw text at specified position (for use by other renderers)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {string} content - Text content
 * @param {Object} options - Text options
 * @param {Overlay} overlay - Overlay manager instance (optional)
 */
function drawText(ctx, x, y, content, options, overlay) {
    if (!content) return;

    var opts = mergeOptions(options);

    ctx.save();

    // Set font
    ctx.font = buildFontString(opts);
    ctx.fillStyle = opts.color;
    ctx.textAlign = opts.align;
    ctx.textBaseline = opts.baseline;

    // Move to position and rotate
    ctx.translate(x, y);
    if (opts.rotation) {
        ctx.rotate(opts.rotation);
    }

    // Draw background
    if (opts.background) {
        var metrics = ctx.measureText(content);
        var bgWidth = metrics.width + 6;
        var bgHeight = opts.fontSize + 4;
        ctx.fillStyle = opts.background;

        // Adjust for alignment
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
