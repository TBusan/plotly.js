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
 *
 * CRITICAL: This function works on SCALED coordinates (canvas space)
 * because we're generating SVG path strings for Canvas rendering.
 * The key difference from Plotly.js is that we need to scale paths here
 * since Canvas doesn't have automatic coordinate transforms like SVG.
 *
 * @param {Object} pathInfo - Path info object
 * @param {Array} perimeter - Perimeter points (already scaled to canvas space)
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
        // CRITICAL FIX: Keep the original path points for endpt calculation
        // Scale and smooth ONLY for the SVG path string
        var currentPath = edgepaths[i];

        // Safety check: skip invalid or empty paths
        if (!currentPath || !Array.isArray(currentPath) || currentPath.length === 0) {
            startsleft.splice(startsleft.indexOf(i), 1);
            if (startsleft.length > 0) {
                i = startsleft[0];
                newloop = true;
            }
            continue;
        }

        // Generate smooth SVG path string (scaled)
        var scaledPath = currentPath.map(function(pt) {
            return scalePoint(style, pt);
        });
        addpath = smooth.smoothopen(scaledPath, pathInfo.smoothing || 0);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        // CRITICAL: Use the ORIGINAL path's last point (before smoothing!)
        // but SCALED to canvas space for comparison with perimeter
        endpt = scalePoint(style, currentPath[currentPath.length - 1]);
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
                // CRITICAL: Use the ORIGINAL path's first point (before smoothing!)
                // but SCALED to canvas space
                // Safety check: skip invalid paths
                if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) ||
                    edgepaths[possiblei].length === 0) {
                    continue;
                }
                var ptNew = scalePoint(style, edgepaths[possiblei][0]);

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

    // Finally add the interior closed paths
    for (i = 0; i < pathInfo.paths.length; i++) {
        // Safety check: skip invalid paths
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
 * @param {string} color1 - Start color (hex)
 * @param {string} color2 - End color (hex)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated color (hex)
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
 * Maps value to color using the color scale array
 */
function getColorForValue(value, colorScale) {
    if (!colorScale || !Array.isArray(colorScale)) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    // colorScale is in format [[position, color], ...]
    // position is 0-1, color is hex string
    var n = colorScale.length;

    if (n === 0) return 'rgba(100, 100, 100, 0.5)';
    if (n === 1) return colorScale[0][1];

    // Find the two colors to interpolate between
    for (var i = 0; i < n - 1; i++) {
        if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
            var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
            return interpolateColor(colorScale[i][1], colorScale[i + 1][1], t);
        }
    }

    // If value is outside the range, clamp it
    if (value < colorScale[0][0]) return colorScale[0][1];
    if (value > colorScale[n - 1][0]) return colorScale[n - 1][1];

    return colorScale[Math.floor(n / 2)][1];
}

/**
 * Get color for a contour level
 * This implements the Plotly logic:
 * - For auto-generated levels: use midpoint between levels (level + 0.5 * step)
 * - For custom thresholds: use midpoint between consecutive thresholds
 * - Colors are normalized to the full threshold range
 */
function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize) {
    var value;

    if (hasCustomLevels) {
        // For custom thresholds, use the midpoint between this level and the next
        if (levelIndex < levels.length - 1) {
            // Midpoint between this threshold and the next one
            value = (levels[levelIndex] + levels[levelIndex + 1]) / 2;
        } else {
            // For the highest threshold, use a value above it
            var lastStep = levels.length > 1 ? (levels[levels.length - 1] - levels[levels.length - 2]) : 1;
            value = levels[levelIndex] + lastStep / 2;
        }
    } else {
        // For auto-generated levels, add half the step size
        value = level + 0.5 * stepSize;
    }

    // Normalize value to 0-1 range for color scale
    var minVal = levels[0];
    var maxVal = levels[levels.length - 1];
    var range = maxVal - minVal;

    if (range === 0) return colorScale[0][1];

    // Clamp normalized value to [0, 1] to handle edge cases
    var normalizedValue = (value - minVal) / range;
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

    return getColorForValue(normalizedValue, colorScale);
}

/**
 * Draw filled contour paths
 * This matches Plotly's original makeFills logic
 *
 * Key points from Plotly implementation:
 * 1. Background layer uses colorMap(firstFill - 0.5 * cs)
 * 2. Each fill layer uses colorMap(level + 0.5 * cs)
 * 3. Uses default (nonzero) fill rule, NOT even-odd
 * 4. Draws from lowest to highest level
 *
 * CRITICAL FIX: Also draw stroke lines here to avoid double-smoothing
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

    // Determine if we have custom thresholds
    var hasCustomLevels = style.thresholds && Array.isArray(style.thresholds);
    var stepSize = 0;

    if (!hasCustomLevels && levels.length > 1) {
        stepSize = levels[1] - levels[0];
    }

    // Prepare color scale from style
    var colorScale;
    if (style.colorScale && Array.isArray(style.colorScale)) {
        colorScale = style.colorScale;
    } else if (typeof style.colorscale === 'string') {
        // Use preset color scale name
        var colors = require('../../colorbar/colors');
        var parsed = colors.parseColorscale(style.colorscale);
        colorScale = parsed;
    } else {
        // Default to a simple gradient
        colorScale = [[0, 'blue'], [1, 'red']];
    }

    // Step 1: Draw background layer
    // This fills the entire area with the color below the first contour
    var bgColor;
    if (hasCustomLevels) {
        // For custom thresholds, use a value below the first threshold
        // We estimate this as: firstThreshold - (firstThreshold - minDataValue) / 2
        // But since we don't have minDataValue here, we use a fraction of the first interval
        if (levels.length > 1) {
            var firstInterval = levels[1] - levels[0];
            var bgValue = levels[0] - firstInterval / 2;
            // Normalize and clamp
            var minVal = levels[0];
            var maxVal = levels[levels.length - 1];
            var range = maxVal - minVal;
            var normalizedBg = (bgValue - minVal) / range;
            normalizedBg = Math.max(0, Math.min(1, normalizedBg));
            bgColor = getColorForValue(normalizedBg, colorScale);
        } else {
            // Only one threshold - use a default color below it
            bgColor = getColorForLevel(levels[0], 0, levels, colorScale, true, stepSize);
        }
    } else {
        // For auto-generated levels, use firstLevel - 0.5 * step
        var bgValue = levels[0] - 0.5 * stepSize;
        var minVal = levels[0];
        var maxVal = levels[levels.length - 1];
        var range = maxVal - minVal;
        var normalizedBg = (bgValue - minVal) / range;
        normalizedBg = Math.max(0, Math.min(1, normalizedBg));
        bgColor = getColorForValue(normalizedBg, colorScale);
    }

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.fill();  // Use default (nonzero) fill rule

    // Step 2: Draw each contour fill layer
    // Draw from LOWEST to HIGHEST (critical!)
    // Each layer draws the region ABOVE that contour level
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Get color for this level
        var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, hasCustomLevels, stepSize);
        ctx.fillStyle = fillColor;

        // Build the complete path string
        var boundaryPath = 'M' + perimeter.join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = '';

        // Use prefixBoundary flag to determine if we need to add the boundary
        if (pathInfo.prefixBoundary) {
            fullpath = boundaryPath + joinedPaths;
        } else {
            fullpath = joinedPaths;
        }

        // Draw the path using default (nonzero) fill rule
        // This is key - nonzero handles nested contours correctly for fill mode
        if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill();  // Use default fill rule, NOT even-odd

            // CRITICAL FIX: Draw stroke lines here using the SAME path
            // This ensures lines and fills match exactly (no double-smoothing)
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
 *
 * IMPORTANT: Points from pathfinding are in DATA SPACE (actual x/y values from the grid),
 * not grid index space. We need to normalize them to [0, 1] first, then scale to canvas.
 *
 * @param {Object} style - Style options containing x, y arrays for data range
 * @param {Array} pt - Point [x, y] in DATA SPACE
 * @returns {Array} Scaled point [canvasX, canvasY]
 */
function scalePoint(style, pt) {
    var x = style.x || [];
    var y = style.y || [];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    // Get data range
    var xMin = x.length > 0 ? Math.min.apply(Math, x) : 0;
    var xMax = x.length > 0 ? Math.max.apply(Math, x) : 1;
    var yMin = y.length > 0 ? Math.min.apply(Math, y) : 0;
    var yMax = y.length > 0 ? Math.max.apply(Math, y) : 1;

    // Avoid division by zero
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    // Normalize to [0, 1] and scale to canvas
    var canvasX = padding + ((pt[0] - xMin) / xRange) * (width - 2 * padding);
    var canvasY = padding + ((pt[1] - yMin) / yRange) * (height - 2 * padding);

    // Flip Y axis (canvas Y increases downward, data Y increases upward)
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
