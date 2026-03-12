'use strict';

/**
 * Shape drawing module
 * Supports circle, square, triangle, diamond, star and custom shapes
 */

/**
 * Draw a circle shape
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size (diameter)
 */
function drawCircle(ctx, x, y, size) {
    var radius = size / 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.closePath();
}

/**
 * Draw a square shape
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size (width/height)
 */
function drawSquare(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.rect(x - half, y - half, size, size);
    ctx.closePath();
}

/**
 * Draw a triangle shape
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size
 */
function drawTriangle(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y + half);
    ctx.lineTo(x - half, y + half);
    ctx.closePath();
}

/**
 * Draw a diamond shape
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size
 */
function drawDiamond(ctx, x, y, size) {
    var half = size / 2;
    ctx.beginPath();
    ctx.moveTo(x, y - half);
    ctx.lineTo(x + half, y);
    ctx.lineTo(x, y + half);
    ctx.lineTo(x - half, y);
    ctx.closePath();
}

/**
 * Draw a star shape (5-pointed)
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size
 */
function drawStar(ctx, x, y, size) {
    var outerRadius = size / 2;
    var innerRadius = outerRadius * 0.4;
    var points = 5;

    ctx.beginPath();
    for (var i = 0; i < points * 2; i++) {
        var radius = i % 2 === 0 ? outerRadius : innerRadius;
        var angle = (i * Math.PI / points) - Math.PI / 2;
        var px = x + Math.cos(angle) * radius;
        var py = y + Math.sin(angle) * radius;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
}

/**
 * Draw a cross/plus shape
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {number} x - Center X coordinate
 * @param {number} y - Center Y coordinate
 * @param {number} size - Size
 */
function drawCross(ctx, x, y, size) {
    var half = size / 2;
    var thick = size / 4;

    ctx.beginPath();
    // Vertical bar
    ctx.rect(x - thick / 2, y - half, thick, size);
    // Horizontal bar
    ctx.rect(x - half, y - thick / 2, size, thick);
    ctx.closePath();
}

/**
 * Get shape drawing function by shape name
 * @param {string} shape - Shape name ('circle', 'square', 'triangle', 'diamond', 'star', 'cross')
 * @returns {Function} Drawing function
 */
function getShapeDrawer(shape) {
    var shapeMap = {
        'circle': drawCircle,
        'square': drawSquare,
        'triangle': drawTriangle,
        'diamond': drawDiamond,
        'star': drawStar,
        'cross': drawCross
    };
    return shapeMap[shape] || drawCircle;
}

/**
 * Check if shape is a custom shape (SVG or image)
 * @param {string|Object} shape - Shape name or custom shape config
 * @returns {boolean} True if custom shape
 */
function isCustomShape(shape) {
    return typeof shape === 'object' && (shape.svg || shape.image);
}

module.exports = {
    drawCircle: drawCircle,
    drawSquare: drawSquare,
    drawTriangle: drawTriangle,
    drawDiamond: drawDiamond,
    drawStar: drawStar,
    drawCross: drawCross,
    getShapeDrawer: getShapeDrawer,
    isCustomShape: isCustomShape
};
