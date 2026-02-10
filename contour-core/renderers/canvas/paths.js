'use strict';

/**
 * Canvas path drawing for contours
 */

var smooth = require('../../smooth');

/**
 * Create perimeter path for boundary closing
 */
function createPerimeter(style) {
    var m = style.z ? style.z.length : 10;
    var n = (style.z && style.z[0]) ? style.z[0].length : 10;
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
 * Works on SCALED coordinates (canvas space)
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
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

    // Process edge paths
    while (startsleft.length > 0) {
        var currentPath = edgepaths[i];

        // Skip invalid paths
        if (!currentPath || !Array.isArray(currentPath) || currentPath.length === 0) {
            startsleft.splice(startsleft.indexOf(i), 1);
            if (startsleft.length > 0) {
                i = startsleft[0];
                newloop = true;
            }
            continue;
        }

        // Generate smooth SVG path string
        var scaledPath = currentPath.map(function(pt) {
            return scalePoint(style, pt);
        });
        addpath = smooth.smoothopen(scaledPath, pathInfo.smoothing || 0);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        // Use original path point for endpt (scaled)
        endpt = scalePoint(style, currentPath[currentPath.length - 1]);
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
            else if (isleft(endpt)) newendpt = perimeter[0];
            else if (isbottom(endpt)) newendpt = perimeter[3];
            else if (isright(endpt)) newendpt = perimeter[2];

            // Find next path starting on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) ||
                    edgepaths[possiblei].length === 0) {
                    continue;
                }
                var ptNew = scalePoint(style, edgepaths[possiblei][0]);

                // Check if ptNew is on the segment
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
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop) {
            if (startsleft.length > 0) {
                i = startsleft[0];
            }
            fullpath += 'Z';
        }
    }

    // Add interior closed paths
    for (i = 0; i < pathInfo.paths.length; i++) {
        if (!pathInfo.paths[i] || !Array.isArray(pathInfo.paths[i]) ||
            pathInfo.paths[i].length === 0) {
            continue;
        }
        var scaledPath = pathInfo.paths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        fullpath += smooth.smoothclosed(scaledPath, pathInfo.smoothing || 0);
    }

    return fullpath;
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1, color2, t) {
    // Parse hex colors
    var r1 = parseInt(color1.slice(1, 3), 16);
    var g1 = parseInt(color1.slice(3, 5), 16);
    var b1 = parseInt(color1.slice(5, 7), 16);

    var r2 = parseInt(color2.slice(1, 3), 16);
    var g2 = parseInt(color2.slice(3, 5), 16);
    var b2 = parseInt(color2.slice(5, 7), 16);

    // Clamp t to [0, 1]
    t = Math.max(0, Math.min(1, t));

    // Interpolate
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);

    // Convert back to hex
    return '#' + [r, g, b].map(function(x) {
        var hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * Get color for a value from color scale
 */
function getColorForValue(value, colorScale) {
    if (!colorScale || !Array.isArray(colorScale)) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    var n = colorScale.length;
    if (n === 0) return 'rgba(100, 100, 100, 0.5)';
    if (n === 1) return colorScale[0][1];

    // Find interpolation interval
    for (var i = 0; i < n - 1; i++) {
        if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
            var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
            return interpolateColor(colorScale[i][1], colorScale[i + 1][1], t);
        }
    }

    // Clamp to range
    if (value < colorScale[0][0]) return colorScale[0][1];
    if (value > colorScale[n - 1][0]) return colorScale[n - 1][1];
    return colorScale[Math.floor(n / 2)][1];
}

/**
 * Get color for a value using segmented color mapping (valueColorMap)
 * valueColorMap format: [[threshold, color], ...]
 * Example: [[10, 'red'], [20, 'blue'], [30, 'green']]
 *          value < 10 uses 'red', 10-20 uses 'blue', >= 30 uses 'green'
 */
function getColorForSegmentedValue(value, valueColorMap) {
    if (!valueColorMap || !Array.isArray(valueColorMap) || valueColorMap.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    // If value is below first threshold, use first color
    if (value < valueColorMap[0][0]) {
        return valueColorMap[0][1];
    }

    // Find the appropriate segment
    for (var i = 0; i < valueColorMap.length - 1; i++) {
        if (value >= valueColorMap[i][0] && value < valueColorMap[i + 1][0]) {
            return valueColorMap[i][1];
        }
    }

    // If value is at or above last threshold, use last color
    return valueColorMap[valueColorMap.length - 1][1];
}

/**
 * Get color for a contour level
 * Supports:
 * 1. valueColorMap: Segmented color mapping [[threshold, color], ...]
 * 2. colorScale: [[0, color], ...] normalized format
 * 3. [[level, color], ...] direct level-to-color mapping
 */
function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize, valueColorMap) {
    // PRIORITY 1: Use valueColorMap (segmented color mapping) if provided
    if (valueColorMap && Array.isArray(valueColorMap) && valueColorMap.length > 0) {
        // For segmented mapping, the color is determined by the value relative to thresholds
        // Each level represents a threshold boundary, so we use the midpoint of the segment
        var segmentValue;
        if (levelIndex < valueColorMap.length - 1) {
            // Midpoint between this threshold and next
            segmentValue = (valueColorMap[levelIndex][0] + valueColorMap[levelIndex + 1][0]) / 2;
        } else if (levelIndex === valueColorMap.length - 1) {
            // Last segment: value above the last threshold
            segmentValue = valueColorMap[levelIndex][0] + 1; // Just above the threshold
        } else {
            segmentValue = level;
        }
        return getColorForSegmentedValue(segmentValue, valueColorMap);
    }

    // Validate inputs for other color modes
    if (!colorScale || colorScale.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    if (!levels || levels.length === 0) {
        return colorScale[0][1] || 'rgba(100, 100, 100, 0.5)';
    }

    // Check if colorScale is in [[level, color], ...] format
    var firstVal = colorScale[0][0];

    // If first value is close to the first level, assume [[level, color], ...] format
    if (Math.abs(firstVal - levels[0]) < Math.abs(firstVal) + 0.1) {
        // Find exact level match
        for (var i = 0; i < colorScale.length; i++) {
            if (Math.abs(colorScale[i][0] - level) < 0.01) {
                return colorScale[i][1];
            }
        }

        // If no exact match, find closest
        var closestIdx = 0;
        var closestDist = Math.abs(colorScale[0][0] - level);
        for (var j = 1; j < colorScale.length; j++) {
            var dist = Math.abs(colorScale[j][0] - level);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = j;
            }
        }
        return colorScale[closestIdx][1];
    }

    // Original logic for [[0, color], ...] format
    var value;

    if (hasCustomLevels) {
        if (levelIndex < levels.length - 1) {
            value = (levels[levelIndex] + levels[levelIndex + 1]) / 2;
        } else {
            var lastStep = levels.length > 1 ? (levels[levels.length - 1] - levels[levels.length - 2]) : 1;
            value = levels[levelIndex] + lastStep / 2;
        }
    } else {
        value = level + 0.5 * stepSize;
    }

    var minVal = levels[0];
    var maxVal = levels[levels.length - 1];
    var range = maxVal - minVal;

    if (range === 0) {
        return colorScale[0][1] || 'rgba(100, 100, 100, 0.5)';
    }

    var normalizedValue = (value - minVal) / range;
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

    return getColorForValue(normalizedValue, colorScale);
}

/**
 * Draw filled contour paths
 * Matches Plotly's fill logic with stroke lines to avoid double-smoothing
 */
function drawFilledPaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var smoothing = style.smoothing || 0;
    var perimeter = createPerimeter(style);
    var showLines = style.showLines !== false;
    var lineColor = style.lineColor || '#333';
    var lineWidth = style.lineWidth || 1.5;

    if (paths.length === 0) return;

    // Determine thresholds and color scale
    var hasCustomLevels = style.thresholds && Array.isArray(style.thresholds);
    var stepSize = (!hasCustomLevels && levels.length > 1) ? levels[1] - levels[0] : 0;
    var colorScale = style.colorScale;
    var valueColorMap = style.valueColorMap; // Segmented color mapping [[value, color], ...]
    if (!colorScale) {
        if (typeof style.colorscale === 'string') {
            var colors = require('../../colorbar/colors');
            colorScale = colors.parseColorscale(style.colorscale);
        } else {
            colorScale = [[0, 'blue'], [1, 'red']];
        }
    }

    // Debug: Log colorScale info
    if (typeof window !== 'undefined' && window.console) {
        console.log('[drawFilledPaths] colorScale:', colorScale ? colorScale.slice(0, 3) : null);
    }

    // Draw background layer
    var bgColor;
    if (valueColorMap) {
        // For segmented mapping, background uses the first color (below minimum threshold)
        bgColor = valueColorMap[0][1];
    } else if (hasCustomLevels) {
        if (levels.length > 1) {
            var firstInterval = levels[1] - levels[0];
            var bgValue = levels[0] - firstInterval / 2;
            var minVal = levels[0];
            var maxVal = levels[levels.length - 1];
            var range = maxVal - minVal;
            var normalizedBg = (bgValue - minVal) / range;
            normalizedBg = Math.max(0, Math.min(1, normalizedBg));
            bgColor = getColorForValue(normalizedBg, colorScale);
        } else {
            bgColor = getColorForLevel(levels[0], 0, levels, colorScale, true, stepSize, null);
        }
    } else {
        var bgValue = levels[0] - 0.5 * stepSize;
        var minVal = levels[0];
        var maxVal = levels[levels.length - 1];
        var range = maxVal - minVal;
        var normalizedBg = (bgValue - minVal) / range;
        normalizedBg = Math.max(0, Math.min(1, normalizedBg));
        bgColor = getColorForValue(normalizedBg, colorScale);
    }

    // Draw background layer only within data area (perimeter)
    // This prevents filling outside the data bounds
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.rect(perimeter[0][0], perimeter[0][1],
             perimeter[1][0] - perimeter[0][0],
             perimeter[2][1] - perimeter[0][1]);
    ctx.fill();

    // Draw each contour fill layer (LOWEST to HIGHEST)
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Get color and build path
        var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);
        ctx.fillStyle = fillColor;

        // Debug log
        if (typeof window !== 'undefined' && window.console && i < 3) {
            console.log('[drawFilledPaths] Path ' + i + ' level=' + pathInfo.level + ' fillColor=' + fillColor +
                        ' edgepaths=' + pathInfo.edgepaths.length + ' paths=' + pathInfo.paths.length +
                        ' prefixBoundary=' + pathInfo.prefixBoundary);
        }

        var boundaryPath = 'M' + perimeter.map(function(pt) { return pt.join(' '); }).join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = pathInfo.prefixBoundary ? (boundaryPath + joinedPaths) : joinedPaths;

        // Draw path with fill and optional stroke
        if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill();

            if (showLines) {
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = lineWidth;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }
    }
}

/**
 * Draw contour line strokes
 */
function drawStrokePaths(ctx, contourResult, style) {
    var paths = contourResult.paths;
    var levels = contourResult.levels;
    var smoothing = style.smoothing || 0;
    var colorScale = style.colorScale;
    var useColorScale = colorScale && Array.isArray(colorScale) && colorScale.length > 0;

    ctx.lineWidth = style.lineWidth || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Set color for this level
        if (useColorScale) {
            // Find color for this level
            var level = pathInfo.level;
            var color = '#333'; // default

            for (var j = 0; j < colorScale.length; j++) {
                if (Math.abs(colorScale[j][0] - level) < 0.01) {
                    color = colorScale[j][1];
                    break;
                }
            }
            ctx.strokeStyle = color;
        } else {
            ctx.strokeStyle = style.lineColor || '#333';
        }

        // Draw closed paths
        for (var k = 0; k < pathInfo.paths.length; k++) {
            drawPathStroke(ctx, pathInfo.paths[k], smoothing, true, style);
        }

        // Draw edge paths
        for (k = 0; k < pathInfo.edgepaths.length; k++) {
            drawPathStroke(ctx, pathInfo.edgepaths[k], smoothing, false, style);
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
 * Scale point from DATA SPACE to canvas coordinates
 */
function scalePoint(style, pt) {
    // Validate inputs
    if (!pt || !Array.isArray(pt) || pt.length < 2) {
        console.warn('scalePoint: Invalid point', pt);
        return [0, 0];
    }

    if (isNaN(pt[0]) || isNaN(pt[1])) {
        console.warn('scalePoint: Point contains NaN', pt);
        return [0, 0];
    }

    var x = style.x || [];
    var y = style.y || [];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    // Get data range
    var xMin = (x && x.length > 0) ? Math.min.apply(Math, x) : 0;
    var xMax = (x && x.length > 0) ? Math.max.apply(Math, x) : 10;
    var yMin = (y && y.length > 0) ? Math.min.apply(Math, y) : 0;
    var yMax = (y && y.length > 0) ? Math.max.apply(Math, y) : 10;

    // Avoid division by zero
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    // Normalize to [0, 1] and scale to canvas
    var canvasX = padding + ((pt[0] - xMin) / xRange) * (width - 2 * padding);
    var canvasY = padding + ((pt[1] - yMin) / yRange) * (height - 2 * padding);

    // Flip Y axis (canvas Y increases downward)
    canvasY = height - padding - (canvasY - padding);

    return [canvasX, canvasY];
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
