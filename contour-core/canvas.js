'use strict';

/**
 * Canvas renderer for contour-core
 * Renders contour paths on an HTML5 Canvas
 */

var smooth = require('./smooth');

/**
 * Draw contours on a canvas context
 * Adapted from Plotly.js src/traces/contour/plot.js
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} style - Rendering options
 */
function drawContours(ctx, contourResult, style) {
    style = style || {};

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var coloring = style.coloring || 'lines';
    var showLines = style.showLines !== false;
    var smoothing = style.smoothing || 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Determine scale factors (default to grid indices)
    var n = contourResult.pathinfo[0].x.length;
    var m = contourResult.pathinfo[0].y.length;
    var padding = style.padding || 30;

    // Scale to fit canvas with padding
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    function scalePoint(pt) {
        return [
            padding + pt[0] * scaleX,
            padding + (m - 1 - pt[1]) * scaleY  // Flip Y for canvas coordinates
        ];
    }

    // Calculate perimeter (boundary)
    var perimeter = [
        [padding, padding],                              // top-left
        [width - padding, padding],                       // top-right
        [width - padding, height - padding],              // bottom-right
        [padding, height - padding]                      // bottom-left
    ];

    // Draw background if needed (for fill mode)
    if (coloring === 'fill' || coloring === 'heatmap') {
        makeBackground(ctx, perimeter, coloring);
    }

    // Draw fills (using even-odd rule)
    if (coloring === 'fill') {
        makeFills(ctx, contourResult, perimeter, scalePoint, smoothing, style);
    }

    // Draw heatmap (for heatmap mode)
    if (coloring === 'heatmap') {
        makeHeatmap(ctx, contourResult, perimeter, scalePoint, style);
    }

    // Draw lines
    if (showLines && coloring !== 'heatmap') {
        makeLines(ctx, contourResult, scalePoint, smoothing, style);
    }
}

/**
 * Draw background rectangle
 */
function makeBackground(ctx, perimeter, coloring) {
    if (coloring !== 'fill') return;

    ctx.fillStyle = '#fff';  // Default background
    ctx.beginPath();
    ctx.moveTo(perimeter[0][0], perimeter[0][1]);
    ctx.lineTo(perimeter[1][0], perimeter[1][1]);
    ctx.lineTo(perimeter[2][0], perimeter[2][1]);
    ctx.lineTo(perimeter[3][0], perimeter[3][1]);
    ctx.closePath();
    ctx.fill();
}

/**
 * Draw filled contours using even-odd rule
 * Adapted from Plotly.js makeFills
 */
function makeFills(ctx, contourResult, perimeter, scalePoint, smoothing, style) {
    var boundaryPath = 'M' + perimeter.join('L') + 'Z';
    var pathinfo = contourResult.paths;

    for (var i = 0; i < pathinfo.length; i++) {
        var pi = pathinfo[i];

        // Skip if no paths to draw
        if (!pi.edgepaths && !pi.paths) continue;
        if (pi.edgepaths && pi.edgepaths.length === 0 && (!pi.paths || pi.paths.length === 0)) continue;

        var fullpath = '';

        // Add boundary prefix if needed
        if (pi.prefixBoundary) {
            fullpath = boundaryPath + joinAllPaths(pi, perimeter, scalePoint, smoothing);
        } else {
            fullpath = joinAllPaths(pi, perimeter, scalePoint, smoothing);
        }

        if (!fullpath) continue;

        // Get color for this level
        var color = getColorForLevel(pi.level, contourResult.levels, style);

        // Draw the fill path
        drawSVGPathString(ctx, fullpath, {
            fill: color,
            stroke: 'none'
        });
    }
}

/**
 * Join all paths together for even-odd fill
 * Adapted from Plotly.js joinAllPaths
 */
function joinAllPaths(pi, perimeter, scalePoint, smoothing) {
    var fullpath = '';

    // Validate edgepaths
    if (!pi.edgepaths || pi.edgepaths.length === 0) {
        return fullpath;
    }

    // Filter out invalid paths
    var validEdgePaths = [];
    for (var i = 0; i < pi.edgepaths.length; i++) {
        var path = pi.edgepaths[i];
        // Check path exists, has points, and first point is a valid [x, y] array
        if (path && Array.isArray(path) && path.length > 0) {
            var firstPoint = path[0];
            if (firstPoint && Array.isArray(firstPoint) && firstPoint.length >= 2) {
                validEdgePaths.push(path);
            }
        }
    }

    if (validEdgePaths.length === 0) {
        return fullpath;
    }

    var startsleft = validEdgePaths.map(function(v, idx) { return idx; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

    function istop(pt) { return Math.abs(pt[1] - perimeter[0][1]) < 0.5; }
    function isbottom(pt) { return Math.abs(pt[1] - perimeter[2][1]) < 0.5; }
    function isleft(pt) { return Math.abs(pt[0] - perimeter[0][0]) < 0.5; }
    function isright(pt) { return Math.abs(pt[0] - perimeter[2][0]) < 0.5; }

    while (startsleft.length) {
        var i = startsleft[0];
        addpath = smoothPath(validEdgePaths[i], scalePoint, smoothing, false);
        if (!addpath) {
            startsleft.splice(startsleft.indexOf(i), 1);
            continue;
        }
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);
        endpt = getLastPoint(validEdgePaths[i]);
        nexti = -1;

        // Loop around perimeter until we find a new start
        for (cnt = 0; cnt < 4 && endpt; cnt++) {
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // right top
            else if (isleft(endpt)) newendpt = perimeter[0]; // left top
            else if (isbottom(endpt)) newendpt = perimeter[3]; // right bottom
            else if (isright(endpt)) newendpt = perimeter[2]; // left bottom
            else break; // Not on perimeter - stop walking

            if (!newendpt) break; // Safety check

            fullpath += 'L' + newendpt[0] + ' ' + newendpt[1];

            // Look for a path starting at this new endpoint
            nexti = -1;
            for (possiblei = 0; possiblei < validEdgePaths.length; possiblei++) {
                var pathStart = getFirstPoint(validEdgePaths[possiblei]);
                if (pathStart && Math.abs(pathStart[0] - newendpt[0]) < 0.5 &&
                    Math.abs(pathStart[1] - newendpt[1]) < 0.5) {
                    nexti = possiblei;
                    break;
                }
            }

            if (nexti >= 0) {
                // Found a path starting here - continue
                startsleft.splice(startsleft.indexOf(nexti), 1);
                endpt = getLastPoint(validEdgePaths[nexti]);
                addpath = smoothPath(validEdgePaths[nexti], scalePoint, smoothing, false);
                if (addpath) {
                    fullpath += 'L' + addpath.replace(/^M/, '');
                }
            } else {
                // No path found - end this loop
                break;
            }
        }

        newloop = false;
    }

    return fullpath;
}

/**
 * Draw heatmap (filled rectangles)
 */
function makeHeatmap(ctx, contourResult, perimeter, scalePoint, style) {
    // For heatmap mode, just draw rectangles
    // This is a simplified implementation
    var pathinfo = contourResult.pathinfo;
    var z = pathinfo[0].z;
    var m = z.length;
    var n = z[0].length;
    var levels = contourResult.levels;

    for (var i = 0; i < m - 1; i++) {
        for (var j = 0; j < n - 1; j++) {
            var z0 = z[i][j];
            var z1 = z[i][j + 1];
            var z2 = z[i + 1][j];
            var z3 = z[i + 1][j + 1];
            if (isNaN(z0) || isNaN(z1) || isNaN(z2) || isNaN(z3)) continue;

            var avgZ = (z0 + z1 + z2 + z3) / 4;
            var color = getColorForLevel(avgZ, levels, style);

            var p1 = scalePoint([j, i]);
            var p2 = scalePoint([j + 1, i]);
            var p3 = scalePoint([j + 1, i + 1]);
            var p4 = scalePoint([j, i + 1]);

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.lineTo(p3[0], p3[1]);
            ctx.lineTo(p4[0], p4[1]);
            ctx.closePath();
            ctx.fill();
        }
    }
}

/**
 * Draw contour lines
 */
function makeLines(ctx, contourResult, scalePoint, smoothing, style) {
    ctx.strokeStyle = style.lineColor || '#666';
    ctx.lineWidth = style.lineWidth || 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    var pathinfo = contourResult.paths;

    for (var i = 0; i < pathinfo.length; i++) {
        var pi = pathinfo[i];

        if (!pi.edgepaths && !pi.paths) continue;

        // Draw edge paths (open contours)
        if (pi.edgepaths) {
            for (var j = 0; j < pi.edgepaths.length; j++) {
                var path = pi.edgepaths[j];
                if (path && path.length > 0) {
                    drawSVGPathString(ctx, smoothPath(path, scalePoint, smoothing, false), {
                        stroke: style.lineColor || '#666',
                        fill: 'none',
                        lineWidth: style.lineWidth || 1
                    });
                }
            }
        }

        // Draw closed paths
        if (pi.paths) {
            for (j = 0; j < pi.paths.length; j++) {
                var path = pi.paths[j];
                if (path && path.length > 0) {
                    drawSVGPathString(ctx, smoothPath(path, scalePoint, smoothing, true), {
                        stroke: style.lineColor || '#666',
                        fill: 'none',
                        lineWidth: style.lineWidth || 1
                    });
                }
            }
        }
    }
}

/**
 * Get color for a contour level
 */
function getColorForLevel(level, levels, style) {
    if (style.colorScale && Array.isArray(style.colorScale)) {
        // Find the color for this level
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

/**
 * Draw a filled path
 */
function drawPath(ctx, path, scalePoint, smoothing, isClosed) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint);

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
 * Draw a path stroke
 */
function drawPathStroke(ctx, path, scalePoint, smoothing, isClosed) {
    if (path.length < 2) return;

    ctx.beginPath();

    var scaledPath = path.map(scalePoint);

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
 * Draw an SVG path string on canvas
 * Simple parser for M, L, C, Q, Z commands
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

/**
 * Smooth a path using smooth.smoothopen or smooth.smoothclosed
 */
function smoothPath(path, scalePoint, smoothing, isClosed) {
    if (!path || path.length === 0) {
        return '';
    }

    var scaledPath = path.map(scalePoint);
    if (smoothing > 0 && isClosed) {
        return smooth.smoothclosed(scaledPath, smoothing);
    } else if (smoothing > 0 && !isClosed) {
        return smooth.smoothopen(scaledPath, smoothing);
    } else {
        // Convert to simple path string (M L L...)
        return 'M ' + scaledPath.map(function(pt) {
            return 'L ' + pt[0] + ' ' + pt[1];
        }).join(' ').replace(/^M L/, 'M ');
    }
}

/**
 * Get first point of a path
 */
function getFirstPoint(path) {
    if (!path || path.length === 0) return null;
    return path[0];
}

/**
 * Get last point of a path
 */
function getLastPoint(path) {
    if (!path || path.length === 0) return null;
    return path[path.length - 1];
}

/**
 * Draw an SVG path string directly
 */
function drawSVGPathString(ctx, pathStr, style) {
    var commands = parseSVGPath(pathStr);

    ctx.beginPath();

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

    if (style && style.fill && style.fill !== 'none') {
        ctx.fillStyle = style.fill;
        ctx.fill();
    }

    if (style && style.stroke && style.stroke !== 'none') {
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.lineWidth || 1;
        ctx.stroke();
    }
}

module.exports = {
    drawContours: drawContours
};
