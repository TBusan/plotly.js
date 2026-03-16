'use strict';

/**
 * Line drawing module
 * 使用 CoordSystem 进行坐标转换
 */

var textDrawer = require('./text');

var DEFAULTS = {
    color: '#000000',
    width: 1,
    style: 'solid',
    cap: 'round',
    join: 'round'
};

function mergeOptions(options) {
    var result = {};
    for (var key in DEFAULTS) {
        result[key] = options && options[key] !== undefined ? options[key] : DEFAULTS[key];
    }
    return result;
}

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

function getAngleAtPoint(points, index) {
    var prev = Math.max(0, index - 1);
    var next = Math.min(points.length - 1, index + 1);
    var dx = points[next].x - points[prev].x;
    var dy = points[next].y - points[prev].y;
    return Math.atan2(dy, dx);
}

/**
 * 计算线段的质心位置（按长度加权的中点）
 * @param {Array} points - Canvas坐标点数组
 * @returns {Object} 包含 point 和 angle 的对象
 */
function getCentroidPosition(points) {
    if (!points || points.length < 2) {
        return { point: points[0] || { x: 0, y: 0 }, angle: 0 };
    }

    // 计算总长度和各段信息
    var totalLen = 0;
    var segments = [];
    for (var i = 0; i < points.length - 1; i++) {
        var dx = points[i + 1].x - points[i].x;
        var dy = points[i + 1].y - points[i].y;
        var len = Math.sqrt(dx * dx + dy * dy);
        segments.push({
            p1: points[i],
            p2: points[i + 1],
            len: len,
            dx: dx,
            dy: dy
        });
        totalLen += len;
    }

    if (totalLen === 0) {
        return { point: points[0], angle: 0 };
    }

    // 找到中点所在的线段
    var halfLen = totalLen / 2;
    var accLen = 0;
    for (var j = 0; j < segments.length; j++) {
        var seg = segments[j];
        if (accLen + seg.len >= halfLen) {
            var t = (halfLen - accLen) / seg.len;
            var centroidPoint = {
                x: seg.p1.x + t * seg.dx,
                y: seg.p1.y + t * seg.dy
            };
            var angle = Math.atan2(seg.dy, seg.dx);
            return { point: centroidPoint, angle: angle };
        }
        accLen += seg.len;
    }

    // fallback
    return { point: points[points.length - 1], angle: 0 };
}

function getPointAtPosition(points, position) {
    if (position === 'start') {
        return { index: 0, point: points[0], isCentroid: false };
    }
    if (position === 'end') {
        return { index: points.length - 1, point: points[points.length - 1], isCentroid: false };
    }
    if (position === 'middle') {
        var midIndex = Math.floor(points.length / 2);
        return { index: midIndex, point: points[midIndex], isCentroid: false };
    }
    // 默认使用质心（按长度加权的中点）
    if (position === 'centroid' || typeof position === 'undefined') {
        var centroidInfo = getCentroidPosition(points);
        return { index: -1, point: centroidInfo.point, angle: centroidInfo.angle, isCentroid: true };
    }
    var idx = Math.min(Math.max(0, position), points.length - 1);
    return { index: idx, point: points[idx], isCentroid: false };
}

/**
 * Draw a single line
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} points - Array of {x, y} data coordinates
 * @param {Object} options - Line options
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function drawLine(ctx, points, options, coordSystem) {
    if (!points || points.length < 2) return;

    var opts = mergeOptions(options);

    ctx.save();

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

    if (canvasPoints.length < 2) {
        ctx.restore();
        return;
    }

    ctx.strokeStyle = opts.color;
    ctx.lineWidth = opts.width;
    ctx.lineCap = opts.cap;
    ctx.lineJoin = opts.join;
    setLineStyle(ctx, opts.style, opts.width);

    ctx.beginPath();
    ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (var j = 1; j < canvasPoints.length; j++) {
        ctx.lineTo(canvasPoints[j].x, canvasPoints[j].y);
    }
    ctx.stroke();

    ctx.restore();

    // Draw text label
    if (options && options.text && options.text.content) {
        var textOpts = options.text;
        // 默认 position 为 'centroid'（按长度加权的中点）
        var position = textOpts.position || 'centroid';
        var posInfo = getPointAtPosition(canvasPoints, position);

        // 默认 rotation 为 'auto'（跟随线段角度）
        var rotation = textOpts.rotation !== undefined ? textOpts.rotation : 'auto';
        var angle;
        if (rotation === 'auto') {
            if (posInfo.isCentroid && posInfo.angle !== undefined) {
                // 质心位置已经计算好了角度
                angle = posInfo.angle;
            } else {
                angle = getAngleAtPoint(canvasPoints, posInfo.index);
            }
        } else {
            angle = rotation || 0;
        }

        var offsetX = textOpts.offset ? textOpts.offset[0] : 0;
        var offsetY = textOpts.offset ? textOpts.offset[1] : -opts.width - 10;

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
        });

        ctx.restore();
    }
}

/**
 * Render all lines
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} items - Array of line items
 * @param {CoordSystem} coordSystem - Coordinate system instance
 */
function render(ctx, items, coordSystem) {
    if (!items || items.length === 0) return;

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        drawLine(ctx, item.points, item.options, coordSystem);
    }
}

module.exports = {
    render: render,
    drawLine: drawLine,
    DEFAULTS: DEFAULTS
};
