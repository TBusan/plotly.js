'use strict';

/**
 * Polygon drawing module
 * 使用 CoordSystem 进行坐标转换
 *
 * 支持两种样式格式：
 * 1. 扁平格式（推荐）：
 *    { color: '#ff0000', strokeColor: '#000', strokeWidth: 1 }
 * 2. 嵌套格式（兼容）：
 *    { fill: { type: 'color', color: '#ff0000' }, stroke: { color: '#000', width: 1 } }
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
 * 规范化多边形选项（支持扁平格式和嵌套格式）
 * @param {Object} options - 原始选项
 * @returns {Object} 规范化后的选项
 */
function normalizeOptions(options) {
    options = options || {};

    var fill, stroke;

    // 处理填充：优先使用嵌套的 fill，其次使用扁平格式的 fillColor（不使用 color，因为 color 可能是边框色）
    if (options.fill) {
        // 嵌套格式（最高优先级）
        fill = options.fill;
    } else if (options.fillColor) {
        // 扁平格式 fillColor
        fill = {
            type: 'color',
            color: options.fillColor
        };
    } else if (options.color && !options.strokeColor && !options.stroke) {
        // 扁平格式 color（仅在没有明确边框色时才作为填充色）
        fill = {
            type: 'color',
            color: options.color
        };
    } else {
        fill = DEFAULT_FILL;
    }

    // 处理边框：优先使用嵌套的 stroke，其次使用扁平格式
    if (options.stroke !== undefined) {
        // 嵌套格式（最高优先级）
        stroke = options.stroke;
    } else if (options.strokeColor !== undefined || options.strokeWidth !== undefined) {
        // 扁平格式
        stroke = {
            color: options.strokeColor || DEFAULT_STROKE.color,
            width: options.strokeWidth !== undefined ? options.strokeWidth : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
        };
    } else if (options.color && (options.strokeColor !== undefined || options.width !== undefined)) {
        // 如果有 color 且同时有 stroke 相关属性，color 作为边框色
        stroke = {
            color: options.color,
            width: options.width !== undefined ? options.width : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
        };
    } else if (options.color && options.fill) {
        // 如果同时有 color 和 fill，color 可能是边框色
        stroke = {
            color: options.color,
            width: options.width !== undefined ? options.width : DEFAULT_STROKE.width,
            style: options.strokeStyle || DEFAULT_STROKE.style
        };
    } else if (options.stroke === null) {
        // 明确禁用边框
        stroke = null;
    } else {
        stroke = null; // 默认无边框
    }

    return {
        fill: fill,
        stroke: stroke,
        opacity: options.opacity,
        text: options.text
    };
}

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
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function drawPolygon(ctx, points, options, coordSystem) {
    if (!points || points.length < 3) return;

    // 规范化选项（支持扁平格式和嵌套格式）
    var opts = normalizeOptions(options);

    // Convert coordinates using CoordSystem
    var canvasPoints = [];
    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        var x = p.x !== undefined ? p.x : p[0];
        var y = p.y !== undefined ? p.y : p[1];
        var canvasPos = coordSystem.toCanvas(x, y);
        if (canvasPos) {
            canvasPoints.push(canvasPos);
        }
    }

    if (canvasPoints.length < 3) {
        return;
    }

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var j = 1; j < canvasPoints.length; j++) {
        ctx.lineTo(canvasPoints[j].x, canvasPoints[j].y);
    }
    ctx.closePath();

    // Apply opacity if specified
    if (opts.opacity !== undefined) {
        ctx.globalAlpha = opts.opacity;
    }

    // Fill
    var fill = opts.fill || DEFAULT_FILL;
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

    // Stroke
    var stroke = opts.stroke;
    if (stroke && stroke.color) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width || DEFAULT_STROKE.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

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
    if (opts.text && opts.text.content) {
        var textOpts = opts.text;
        var center;

        if (textOpts.position === 'center' || !textOpts.position) {
            center = calculateCenter(canvasPoints);
        } else if (Array.isArray(textOpts.position)) {
            center = coordSystem.toCanvas(textOpts.position[0], textOpts.position[1]);
        } else {
            center = calculateCenter(canvasPoints);
        }

        if (center) {
            var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
            var offsetY = textOpts.offset ? textOpts.offset[1] : 0;

            textDrawer.drawText(ctx, center.x + offsetX, center.y + offsetY, textOpts.content, {
                fontSize: textOpts.fontSize,
                fontFamily: textOpts.fontFamily,
                fontWeight: textOpts.fontWeight,
                color: textOpts.color,
                background: textOpts.background
            });
        }
    }
}

/**
 * Render all polygons
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of polygon items
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function render(ctx, items, coordSystem) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawPolygon(ctx, item.points, item.options, coordSystem);
    }
}

module.exports = {
    render: render,
    drawPolygon: drawPolygon,
    calculateCenter: calculateCenter,
    DEFAULT_FILL: DEFAULT_FILL,
    DEFAULT_STROKE: DEFAULT_STROKE
};
