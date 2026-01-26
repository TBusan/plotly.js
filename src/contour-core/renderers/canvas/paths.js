'use strict';

/**
 * Canvas path drawing for contours
 * Extracted from canvas.js
 */

var smooth = require('../../smooth');

/**
 * Draw filled contour paths
 */
function drawFilledPaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var smoothing = style.smoothing || 0;

    // Get color for this level
    function getColorForLevel(level) {
        if (style.colorScale && Array.isArray(style.colorScale)) {
            for (var i = 0; i < style.colorScale.length - 1; i++) {
                var stop1 = style.colorScale[i];
                var stop2 = style.colorScale[i + 1];
                if (level >= stop1[0] && level <= stop2[0]) {
                    return stop2[1];
                }
            }
            return style.colorScale[style.colorScale.length - 1][1];
        }
        return 'rgba(100, 100, 100, 0.3)';
    }

    // Draw from HIGHEST to LOWEST for proper layering
    for (var i = paths.length - 1; i >= 0; i--) {
        var pathInfo = paths[i];
        var nextLevel = i < paths.length - 1 ? paths[i + 1].level : levels[levels.length - 1] + 1;
        var midLevel = (pathInfo.level + nextLevel) / 2;

        ctx.fillStyle = getColorForLevel(midLevel);

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            drawPath(ctx, pathInfo.paths[j], smoothing, true, style);
        }

        // Draw edge paths
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            drawEdgePath(ctx, pathInfo.edgepaths[j], smoothing, style);
        }
    }
}

/**
 * Draw contour line strokes
 */
function drawStrokePaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var smoothing = style.smoothing || 0;

    ctx.strokeStyle = style.lineColor || '#333';
    ctx.lineWidth = style.lineWidth || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Draw closed paths
        for (var j = 0; j < pathInfo.paths.length; j++) {
            drawPathStroke(ctx, pathInfo.paths[j], smoothing, true, style);
        }

        // Draw edge paths
        for (j = 0; j < pathInfo.edgepaths.length; j++) {
            drawPathStroke(ctx, pathInfo.edgepaths[j], smoothing, false, style);
        }
    }
}

/**
 * Draw a single path (filled)
 */
function drawPath(ctx, path, smoothing, isClosed, style) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint.bind(null, style));

    if (smoothing > 0 && isClosed) {
        var pathStr = smooth.smoothclosed(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else if (smoothing > 0 && !isClosed) {
        var pathStr = smooth.smoothopen(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else {
        ctx.moveTo(scaledPath[0][0], scaledPath[0][1]);
        for (var i = 1; i < scaledPath.length; i++) {
            ctx.lineTo(scaledPath[i][0], scaledPath[i][1]);
        }
        if (isClosed) {
            ctx.closePath();
        }
    }

    ctx.fill();
}

/**
 * Draw edge path (open at boundary)
 */
function drawEdgePath(ctx, path, smoothing, style) {
    if (path.length < 2) return;

    var first = path[0];
    var last = path[path.length - 1];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = 30;

    ctx.beginPath();
    var start = scalePoint(style, first);
    ctx.moveTo(start[0], start[1]);

    for (var j = 1; j < path.length; j++) {
        var pt = scalePoint(style, path[j]);
        ctx.lineTo(pt[0], pt[1]);
    }

    // Close to appropriate edge
    var lastCanvas = scalePoint(style, last);
    var xMin = padding, xMax = width - padding;
    var yMin = padding, yMax = height - padding;

    if (Math.abs(start[0] - xMin) < 1) {  // Left edge
        ctx.lineTo(xMin, lastCanvas[1]);
        ctx.lineTo(xMin, start[1]);
    } else if (Math.abs(start[0] - xMax) < 1) {  // Right edge
        ctx.lineTo(xMax, lastCanvas[1]);
        ctx.lineTo(xMax, start[1]);
    } else if (Math.abs(start[1] - yMin) < 1) {  // Top edge
        ctx.lineTo(lastCanvas[0], yMin);
        ctx.lineTo(start[0], yMin);
    } else {  // Bottom edge
        ctx.lineTo(lastCanvas[0], yMax);
        ctx.lineTo(start[0], yMax);
    }

    ctx.closePath();
    ctx.fill();
}

/**
 * Draw path stroke
 */
function drawPathStroke(ctx, path, smoothing, isClosed, style) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint.bind(null, style));

    if (smoothing > 0 && isClosed) {
        var pathStr = smooth.smoothclosed(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else if (smoothing > 0 && !isClosed) {
        var pathStr = smooth.smoothopen(scaledPath, smoothing);
        drawSVGPath(ctx, pathStr);
    } else {
        ctx.moveTo(scaledPath[0][0], scaledPath[0][1]);
        for (var i = 1; i < scaledPath.length; i++) {
            ctx.lineTo(scaledPath[i][0], scaledPath[i][1]);
        }
        if (isClosed) {
            ctx.closePath();
        }
    }

    ctx.stroke();
}

/**
 * Scale point to canvas coordinates
 */
function scalePoint(style, pt) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return [
        padding + pt[0] * scaleX,
        padding + (m - 1 - pt[1]) * scaleY
    ];
}

/**
 * Draw SVG path string on canvas
 */
function drawSVGPath(ctx, pathStr) {
    var commands = parseSVGPath(pathStr);

    for (var i = 0; i < commands.length; i++) {
        var cmd = commands[i];
        switch (cmd.type) {
            case 'M':
                ctx.moveTo(cmd.x, cmd.y);
                break;
            case 'L':
                ctx.lineTo(cmd.x, cmd.y);
                break;
            case 'C':
                ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
                break;
            case 'Q':
                ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
                break;
            case 'Z':
                ctx.closePath();
                break;
        }
    }
}

/**
 * Parse SVG path string into commands
 */
function parseSVGPath(pathStr) {
    var commands = [];
    var regex = /([MLCQZ])\s*([^MLCQZ]*)/gi;
    var match;

    while ((match = regex.exec(pathStr)) !== null) {
        var type = match[1];
        var coords = match[2].trim().split(/[\s,]+/).map(Number).filter(function(n) { return !isNaN(n); });

        switch (type) {
            case 'M':
                commands.push({ type: 'M', x: coords[0], y: coords[1] });
                break;
            case 'L':
                for (var i = 0; i < coords.length; i += 2) {
                    commands.push({ type: 'L', x: coords[i], y: coords[i + 1] });
                }
                break;
            case 'C':
                for (i = 0; i < coords.length; i += 6) {
                    commands.push({
                        type: 'C',
                        x1: coords[i], y1: coords[i + 1],
                        x2: coords[i + 2], y2: coords[i + 3],
                        x: coords[i + 4], y: coords[i + 5]
                    });
                }
                break;
            case 'Q':
                for (i = 0; i < coords.length; i += 4) {
                    commands.push({
                        type: 'Q',
                        x1: coords[i], y1: coords[i + 1],
                        x: coords[i + 2], y: coords[i + 3]
                    });
                }
                break;
            case 'Z':
                commands.push({ type: 'Z' });
                break;
        }
    }

    return commands;
}

module.exports = {
    drawFilledPaths: drawFilledPaths,
    drawStrokePaths: drawStrokePaths,
    scalePoint: scalePoint
};
