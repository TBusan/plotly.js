'use strict';

/**
 * Fill pattern module
 * Supports grid, hash, diagonal, dots patterns
 */

// Pattern cache
var patternCache = {};

// Detect environment
var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Create a canvas element (works in both browser and Node.js)
 * @param {number} size - Canvas size
 * @returns {Object} Canvas object
 */
function createCanvas(size) {
    if (isBrowser) {
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        return canvas;
    } else {
        // Node.js environment
        try {
            var nodeCanvas = require('canvas');
            return nodeCanvas.createCanvas(size, size);
        } catch (e) {
            console.warn('node-canvas not available, patterns will not work in SSR');
            return null;
        }
    }
}

/**
 * Create a grid pattern
 * @param {number} size - Pattern size
 * @param {string} color - Pattern color
 * @param {number} lineWidth - Line width
 * @param {CanvasRenderingContext2D} targetCtx - Target canvas context
 * @returns {CanvasPattern} Pattern object
 */
function createGridPattern(size, color, lineWidth, targetCtx) {
    var cacheKey = 'grid_' + size + '_' + color + '_' + lineWidth;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = createCanvas(size);
    if (!canvas) return null;

    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Use target context to create pattern
    var patternCtx = targetCtx || ctx;
    var pattern = patternCtx.createPattern(canvas, 'repeat');
    patternCache[cacheKey] = pattern;
    return pattern;
}

/**
 * Create a hash pattern (diagonal grid)
 * @param {number} size - Pattern size
 * @param {string} color - Pattern color
 * @param {number} lineWidth - Line width
 * @param {number} angle - Diagonal angle in degrees
 * @param {CanvasRenderingContext2D} targetCtx - Target canvas context
 * @returns {CanvasPattern} Pattern object
 */
function createHashPattern(size, color, lineWidth, angle, targetCtx) {
    var cacheKey = 'hash_' + size + '_' + color + '_' + lineWidth + '_' + angle;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = createCanvas(size);
    if (!canvas) return null;

    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    var rad = ((angle || 45) * Math.PI) / 180;
    var offset = size / 2;

    // Diagonal line 1
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(size, offset + size * Math.tan(rad));
    ctx.stroke();

    // Diagonal line 2
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + size * Math.tan(rad), size);
    ctx.stroke();

    // Use target context to create pattern
    var patternCtx = targetCtx || ctx;
    var pattern = patternCtx.createPattern(canvas, 'repeat');
    patternCache[cacheKey] = pattern;
    return pattern;
}

/**
 * Create a diagonal pattern (single direction diagonal lines)
 * @param {number} size - Pattern size
 * @param {string} color - Pattern color
 * @param {number} lineWidth - Line width
 * @param {number} angle - Diagonal angle in degrees
 * @param {CanvasRenderingContext2D} targetCtx - Target canvas context
 * @returns {CanvasPattern} Pattern object
 */
function createDiagonalPattern(size, color, lineWidth, angle, targetCtx) {
    var cacheKey = 'diagonal_' + size + '_' + color + '_' + lineWidth + '_' + angle;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = createCanvas(size);
    if (!canvas) return null;

    var ctx = canvas.getContext('2d');

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth || 1;

    var rad = ((angle || 45) * Math.PI) / 180;

    // Draw diagonal lines across the pattern tile
    ctx.beginPath();
    ctx.moveTo(0, size);
    ctx.lineTo(size, 0);
    ctx.stroke();

    // Use target context to create pattern
    var patternCtx = targetCtx || ctx;
    var pattern = patternCtx.createPattern(canvas, 'repeat');
    patternCache[cacheKey] = pattern;
    return pattern;
}

/**
 * Create a dots pattern
 * @param {number} size - Pattern size
 * @param {string} color - Dot color
 * @param {number} dotSize - Dot radius
 * @param {CanvasRenderingContext2D} targetCtx - Target canvas context
 * @returns {CanvasPattern} Pattern object
 */
function createDotsPattern(size, color, dotSize, targetCtx) {
    var cacheKey = 'dots_' + size + '_' + color + '_' + dotSize;
    if (patternCache[cacheKey]) {
        return patternCache[cacheKey];
    }

    var canvas = createCanvas(size);
    if (!canvas) return null;

    var ctx = canvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, dotSize || (size / 6), 0, Math.PI * 2);
    ctx.fill();

    // Use target context to create pattern
    var patternCtx = targetCtx || ctx;
    var pattern = patternCtx.createPattern(canvas, 'repeat');
    patternCache[cacheKey] = pattern;
    return pattern;
}

/**
 * Create an SVG pattern from data URL
 * @param {string} svgSource - SVG data URL
 * @param {number} size - Pattern size
 * @param {CanvasRenderingContext2D} targetCtx - Target canvas context
 * @param {Function} callback - Callback(pattern) when loaded
 */
function createSVGPattern(svgSource, size, targetCtx, callback) {
    // Browser only for Image loading
    if (typeof Image === 'undefined') {
        if (callback) callback(null);
        return;
    }

    var img = new Image();
    img.onload = function() {
        var canvas = createCanvas(size);
        if (!canvas) {
            if (callback) callback(null);
            return;
        }
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);

        // Use target context to create pattern
        var patternCtx = targetCtx || ctx;
        var pattern = patternCtx.createPattern(canvas, 'repeat');
        if (callback) callback(pattern);
    };
    img.onerror = function() {
        if (callback) callback(null);
    };
    img.src = svgSource;
}

/**
 * Get pattern based on fill configuration
 * @param {Object} fillConfig - Fill configuration
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @returns {CanvasPattern|null} Pattern object
 */
function getPattern(fillConfig, ctx) {
    if (!fillConfig || fillConfig.type !== 'pattern') {
        return null;
    }

    var pattern = fillConfig.pattern;
    var color = fillConfig.patternColor || fillConfig.color || '#000000';
    var size = fillConfig.patternSize || 10;
    var lineWidth = fillConfig.patternLineWidth || 1;

    if (typeof pattern === 'string') {
        switch (pattern) {
            case 'grid':
                return createGridPattern(size, color, lineWidth, ctx);
            case 'hash':
                return createHashPattern(size, color, lineWidth, fillConfig.patternAngle, ctx);
            case 'diagonal':
                return createDiagonalPattern(size, color, lineWidth, fillConfig.patternAngle, ctx);
            case 'dots':
                return createDotsPattern(size, color, fillConfig.patternDotSize, ctx);
        }
    }

    // Custom SVG pattern
    if (typeof pattern === 'object' && pattern.svg) {
        // Note: This is async, but we return null for sync usage
        // The caller should handle async pattern loading separately
        return null;
    }

    return null;
}

/**
 * Clear pattern cache
 */
function clearCache() {
    patternCache = {};
}

module.exports = {
    createGridPattern: createGridPattern,
    createHashPattern: createHashPattern,
    createDiagonalPattern: createDiagonalPattern,
    createDotsPattern: createDotsPattern,
    createSVGPattern: createSVGPattern,
    getPattern: getPattern,
    clearCache: clearCache
};
