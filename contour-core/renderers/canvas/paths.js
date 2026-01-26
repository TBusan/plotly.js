'use strict';

/**
 * Canvas path drawing for contours
 * Based on Plotly's contour filling algorithm
 */

var smooth = require('../../smooth');

/**
 * Create perimeter path for boundary closing
 * @param {Object} style - Style options
 * @returns {Array} Array of [x, y] perimeter points
 */
function createPerimeter(style) {
    var m = style.z ? style.z.length : 10;
    var n = style.z && style.z[0] ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var xMin = padding;
    var xMax = width - padding;
    var yMin = padding;
    var yMax = height - padding;

    // Clockwise perimeter starting from top-left
    return [
        [xMin, yMin],  // 0: top-left
        [xMax, yMin],  // 1: top-right
        [xMax, yMax],  // 2: bottom-right
        [xMin, yMax]   // 3: bottom-left
    ];
}

/**
 * Join all edge paths into a single path with proper boundary connections
 * Based on Plotly's joinAllPaths function
 * @param {Object} pathInfo - Path info object
 * @param {Array} perimeter - Perimeter points
 * @param {Object} style - Style options
 * @returns {String} SVG path string
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        // No paths at all
        return '';
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, i) { return i; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

    function istop(pt) { return Math.abs(pt[1] - perimeter[0][1]) < 0.1; }
    function isbottom(pt) { return Math.abs(pt[1] - perimeter[2][1]) < 0.1; }
    function isleft(pt) { return Math.abs(pt[0] - perimeter[0][0]) < 0.1; }
    function isright(pt) { return Math.abs(pt[0] - perimeter[2][0]) < 0.1; }

    // Process edge paths (open paths that touch the boundary)
    while (startsleft.length > 0) {
        // Scale and smooth the current edge path
        var scaledPath = edgepaths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        addpath = smooth.smoothopen(scaledPath, pathInfo.smoothing || 0);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine which corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1]; // right top
            else if (isleft(endpt)) newendpt = perimeter[0]; // left top
            else if (isbottom(endpt)) newendpt = perimeter[3]; // right bottom
            else if (isright(endpt)) newendpt = perimeter[2]; // left bottom

            // Find next path that starts on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                var ptNew = edgepaths[possiblei].map(function(pt) {
                    return scalePoint(style, pt);
                })[0];

                // Check if ptNew is on the segment from endpt to newendpt
                if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
                    // Vertical edge
                    if (Math.abs(endpt[0] - ptNew[0]) < 0.1 &&
                        (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
                    // Horizontal edge
                    if (Math.abs(endpt[1] - ptNew[1]) < 0.1 &&
                        (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                }
            }

            endpt = newendpt;
            if (nexti >= 0) break;
            fullpath += 'L' + newendpt[0] + ' ' + newendpt[1];
        }

        if (nexti === edgepaths.length || nexti < 0) break;

        i = nexti;

        // if we closed back on a loop we already included,
        // close it and start a new loop
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop) {
            if (startsleft.length > 0) {
                i = startsleft[0];
            }
            fullpath += 'Z';
        }
    }

    // Finally add the interior closed paths (THIS WAS MISSING!)
    for (i = 0; i < pathInfo.paths.length; i++) {
        var scaledPath = pathInfo.paths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        fullpath += smooth.smoothclosed(scaledPath, pathInfo.smoothing || 0);
    }

    return fullpath;
}

/**
 * Draw filled contour paths
 * Using even-odd fill rule with prefixBoundary
 * This matches Plotly's original makeFills logic
 */
function drawFilledPaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var smoothing = style.smoothing || 0;
    var perimeter = createPerimeter(style);

    // Get color for this level (direct mapping, no interpolation)
    function getColorForLevel(level, levelIndex) {
        if (style.colorScale && Array.isArray(style.colorScale)) {
            var nColors = style.colorScale.length;
            var nLevels = levels.length;

            if (nLevels === 0) return style.colorScale[0][1];

            // Map level to color scale directly
            // Each level gets a corresponding color from the scale
            var scaleIndex = Math.floor((levelIndex / nLevels) * (nColors - 1));
            scaleIndex = Math.max(0, Math.min(nColors - 1, scaleIndex));

            return style.colorScale[scaleIndex][1];
        }
        return 'rgba(100, 100, 100, 0.3)';
    }

    // First, draw the entire background with the lowest level color
    // This ensures the base layer is filled
    if (paths.length > 0) {
        ctx.fillStyle = getColorForLevel(levels[0], 0);
        ctx.beginPath();
        ctx.rect(0, 0, width, height);
        ctx.fill();
    }

    // Draw from LOWEST to HIGHEST (this is critical!)
    // Each level draws the region ABOVE that contour
    // Higher levels cover lower levels, creating the proper gradient
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Use the color corresponding to this level
        ctx.fillStyle = getColorForLevel(pathInfo.level, i);

        // Build the complete path string
        var boundaryPath = 'M' + perimeter.join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = '';

        // Use prefixBoundary flag to determine if we need to add the boundary
        // This is set by closeBoundaries() function
        if (pathInfo.prefixBoundary) {
            fullpath = boundaryPath + joinedPaths;
        } else {
            fullpath = joinedPaths;
        }

        // Draw the path using even-odd fill rule (same as SVG)
        if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill('evenodd');  // Use even-odd rule like SVG
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
 * DEPRECATED: Now using joinAllPaths for proper boundary handling
 */
function drawEdgePath(ctx, path, smoothing, style) {
    // This function is kept for backward compatibility
    // but edge paths are now handled in drawFilledPaths via joinAllPaths
    drawPath(ctx, path, smoothing, false, style);
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
