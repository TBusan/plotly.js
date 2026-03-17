'use strict';

/**
 * Canvas path drawing for contours
 */

var smooth = require('../../smooth');

/**
 * Normalize padding to support both number and object formats
 * @param {number|Object} padding - Padding value or object
 * @param {number} [defaultVal] - Default padding value (default: 30)
 * @returns {Object} Normalized padding object { top, right, bottom, left }
 */
function normalizePadding(padding, defaultVal) {
    defaultVal = defaultVal || 30;
    if (typeof padding === 'number') {
        return {
            top: padding,
            right: padding,
            bottom: padding,
            left: padding
        };
    }
    if (typeof padding === 'object' && padding !== null) {
        return {
            top: padding.top !== undefined ? padding.top : defaultVal,
            right: padding.right !== undefined ? padding.right : defaultVal,
            bottom: padding.bottom !== undefined ? padding.bottom : defaultVal,
            left: padding.left !== undefined ? padding.left : defaultVal
        };
    }
    // Default case
    return {
        top: defaultVal,
        right: defaultVal,
        bottom: defaultVal,
        left: defaultVal
    };
}

/**
 * Create index array for coordinate generation
 * @private
 */
function createIndexArray(length, offset) {
    var arr = [];
    for (var i = 0; i < length; i++) {
        arr.push(offset !== undefined ? offset + i : i);
    }
    return arr;
}

/**
 * Create perimeter path for boundary closing (CANVAS coordinates)
 * Used for clipping and not for fill boundary
 */
function createPerimeter(style) {
    var m = (style.z && style.z.length) ? style.z.length : 10;
    var n = (style.z && style.z[0] && style.z[0].length) ? style.z[0].length : 10;
    var width = style.width || 500;
    var height = style.height || 400;

    // Support both number and object format for padding
    var padding = normalizePadding(style.padding, 30);

    var xMin = padding.left;
    var xMax = width - padding.right;
    var yMin = padding.top;
    var yMax = height - padding.bottom;

    // Clockwise perimeter starting from top-left
    return [
        [xMin, yMin],  // 0: top-left
        [xMax, yMin],  // 1: top-right
        [xMax, yMax],  // 2: bottom-right
        [xMin, yMax]   // 3: bottom-left
    ];
}

/**
 * Create data perimeter (DATA coordinates)
 * Used for fill boundary with proper coordinate transformation
 * IMPORTANT: Always uses fullRange for boundary, not visibleRange
 * This ensures contour fill respects the actual data boundaries
 */
function createDataPerimeter(style) {
    var x = style.x || [];
    var y = style.y || [];

    // Always use full data range for boundary, not visibleRange
    // This ensures contour fill respects the actual data boundaries
    var xMin, xMax, yMin, yMax;

    if (style.fullRange) {
        xMin = style.fullRange.xMin;
        xMax = style.fullRange.xMax;
        yMin = style.fullRange.yMin;
        yMax = style.fullRange.yMax;
    } else {
        xMin = (x && x.length > 0) ? Math.min.apply(Math, x) : 0;
        xMax = (x && x.length > 0) ? Math.max.apply(Math, x) : 10;
        yMin = (y && y.length > 0) ? Math.min.apply(Math, y) : 0;
        yMax = (y && y.length > 0) ? Math.max.apply(Math, y) : 10;
    }

    // Clockwise perimeter starting from top-left (in DATA coordinates)
    return [
        [xMin, yMax],  // 0: top-left (data coords, Y decreases upward)
        [xMax, yMax],  // 1: top-right
        [xMax, yMin],  // 2: bottom-right
        [xMin, yMin]   // 3: bottom-left
    ];
}

/**
 * Join all edge paths into a single path with proper boundary connections
 * Uses DATA coordinates for boundary checking, CANVAS coordinates for rendering
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths || [];

    // Validate perimeter
    if (!perimeter || !Array.isArray(perimeter) || perimeter.length < 4) {
        return '';
    }

    // Check all perimeter points are valid
    var validPerimeter = perimeter.every(function(pt) {
        return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (!validPerimeter) {
        return '';
    }

    if (edgepaths.length === 0 && (!pathInfo.paths || pathInfo.paths.length === 0)) {
        return '';
    }

    // Get DATA coordinate boundaries for edge detection
    var x = style.x || [];
    var y = style.y || [];

    // 确保有有效的坐标数组
    if (!x || x.length === 0) x = createIndexArray(style.z ? style.z.length : 10, 1);
    if (!y || y.length === 0) y = createIndexArray(style.z ? style.z[0].length : 10, 1);

    var dataXMin = Math.min.apply(Math, x);
    var dataXMax = Math.max.apply(Math, x);
    var dataYMin = Math.min.apply(Math, y);
    var dataYMax = Math.max.apply(Math, y);

    // Tolerance for boundary detection (relative to data range)
    var tolX = (dataXMax - dataXMin) * 0.001;
    var tolY = (dataYMax - dataYMin) * 0.001;

    // DATA coordinate boundary check functions
    function isDataTop(pt) { return pt && Math.abs(pt[1] - dataYMax) < tolY; }
    function isDataBottom(pt) { return pt && Math.abs(pt[1] - dataYMin) < tolY; }
    function isDataLeft(pt) { return pt && Math.abs(pt[0] - dataXMin) < tolX; }
    function isDataRight(pt) { return pt && Math.abs(pt[0] - dataXMax) < tolX; }

    // Data boundary corners
    var dataCorners = [
        [dataXMin, dataYMax],  // 0: top-left (data coords)
        [dataXMax, dataYMax],  // 1: top-right
        [dataXMax, dataYMin],  // 2: bottom-right
        [dataXMin, dataYMin]   // 3: bottom-left
    ];

    var i = 0;
    var startsleft = edgepaths.map(function(v, i) { return i; });
    var newloop = true;
    var endptData;  // Current endpoint in DATA coordinates
    var newendptData;  // Next endpoint in DATA coordinates
    var cnt;
    var nexti;
    var possiblei;
    var addpath;

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

        // Generate smooth SVG path string using canvas coordinates
        var scaledPath = currentPath.filter(function(pt) {
            return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
        }).map(function(pt) {
            return scalePoint(style, pt);
        }).filter(function(pt) {
            return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
        });

        if (scaledPath.length < 2) {
            startsleft.splice(startsleft.indexOf(i), 1);
            if (startsleft.length > 0) {
                i = startsleft[0];
                newloop = true;
            }
            continue;
        }

        // Use style.smoothing if provided, otherwise fall back to pathInfo.smoothing
        var smoothingValue = style.smoothing !== undefined ? style.smoothing : (pathInfo.smoothing || 0);
        addpath = smooth.smoothopen(scaledPath, smoothingValue);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        // Use DATA coordinate for boundary checking
        endptData = currentPath[currentPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path (using DATA coordinates)
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endptData) break;

            // Determine corner to move to in DATA coordinates
            newendptData = null;

            if (isDataTop(endptData) && !isDataRight(endptData)) newendptData = dataCorners[1];
            else if (isDataLeft(endptData)) newendptData = dataCorners[0];
            else if (isDataBottom(endptData)) newendptData = dataCorners[3];
            else if (isDataRight(endptData)) newendptData = dataCorners[2];
            else {
                // If endptData is not on any data edge, break
                break;
            }

            if (!newendptData) break;

            // Find next path starting on this edge (in DATA coordinates)
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) ||
                    edgepaths[possiblei].length === 0 || !edgepaths[possiblei][0]) {
                    continue;
                }
                var ptNewData = edgepaths[possiblei][0];

                if (!ptNewData || isNaN(ptNewData[0]) || isNaN(ptNewData[1])) continue;

                // Check if ptNewData is on the segment (in DATA coordinates)
                if (Math.abs(endptData[0] - newendptData[0]) < tolX) {
                    // Vertical edge (left or right)
                    if (Math.abs(endptData[0] - ptNewData[0]) < tolX &&
                        (ptNewData[1] - endptData[1]) * (newendptData[1] - ptNewData[1]) >= 0) {
                        newendptData = ptNewData;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endptData[1] - newendptData[1]) < tolY) {
                    // Horizontal edge (top or bottom)
                    if (Math.abs(endptData[1] - ptNewData[1]) < tolY &&
                        (ptNewData[0] - endptData[0]) * (newendptData[0] - ptNewData[0]) >= 0) {
                        newendptData = ptNewData;
                        nexti = possiblei;
                    }
                }
            }

            if (!newendptData) break;

            // Add line to newendpt in CANVAS coordinates
            endptData = newendptData;
            if (nexti >= 0) break;

            var canvasPt = scalePoint(style, newendptData);
            if (canvasPt && !isNaN(canvasPt[0]) && !isNaN(canvasPt[1])) {
                fullpath += 'L' + canvasPt[0] + ' ' + canvasPt[1];
            }
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
        var scaledPath = pathInfo.paths[i].filter(function(pt) {
            return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
        }).map(function(pt) {
            return scalePoint(style, pt);
        }).filter(function(pt) {
            return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
        });

        if (scaledPath.length >= 3) {
            // Use style.smoothing if provided, otherwise fall back to pathInfo.smoothing
            var smoothingValue = style.smoothing !== undefined ? style.smoothing : (pathInfo.smoothing || 0);
            fullpath += smooth.smoothclosed(scaledPath, smoothingValue);
        }
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
 * Get color from colorScale using segmented (step) mapping
 * This is the standard contour fill behavior where each level gets a distinct color.
 *
 * colorScale format: [[level, color], ...] sorted by level
 * Example: [[0, '#0000ff'], [10, '#00bfff'], [20, '#00ff00']]
 *          value < 0 uses '#0000ff', 0-10 uses '#0000ff', 10-20 uses '#00bfff', >= 20 uses '#00ff00'
 *
 * @param {number} value - The value to get color for
 * @param {Array} colorScale - Color scale array [[level, color], ...]
 * @returns {string} Color string
 */
function getColorFromScaleSegmented(value, colorScale) {
    if (!colorScale || !Array.isArray(colorScale) || colorScale.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    var n = colorScale.length;

    // If value is below first level, use first color
    if (value < colorScale[0][0]) {
        return colorScale[0][1];
    }

    // Find the appropriate segment
    // value belongs to segment i if: colorScale[i][0] <= value < colorScale[i+1][0]
    for (var i = 0; i < n - 1; i++) {
        if (value >= colorScale[i][0] && value < colorScale[i + 1][0]) {
            return colorScale[i][1];
        }
    }

    // If value is at or above last level, use last color
    return colorScale[n - 1][1];
}

/**
 * Get color for a contour level
 * Supports:
 * 1. valueColorMap: Segmented color mapping [[threshold, color], ...]
 * 2. colorScale in [[level, color], ...] format - uses SEGMENTED mapping (not interpolation)
 * 3. colorScale in [[0, color], ...] normalized format - uses linear interpolation
 *
 * SEGMENTED MAPPING LOGIC (when colorScale is [[level, color], ...]):
 * - For each contour level, find which segment it belongs to
 * - Use the segment's starting color (no interpolation between colors)
 * - Example: colorScale = [[0, 'blue'], [10, 'green'], [20, 'red']]
 *   - level 5: segment [0, 10) -> blue
 *   - level 12: segment [10, 20) -> green
 *   - level 25: segment >= 20 -> red
 */
function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize, valueColorMap) {
    // PRIORITY 1: Use valueColorMap (segmented color mapping) if provided
    if (valueColorMap && Array.isArray(valueColorMap) && valueColorMap.length > 0) {
        // For segmented mapping, use the level value directly to find the segment
        return getColorForSegmentedValue(level, valueColorMap);
    }

    // Validate inputs for other color modes
    if (!colorScale || colorScale.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    if (!levels || levels.length === 0) {
        return colorScale[0][1] || 'rgba(100, 100, 100, 0.5)';
    }

    // Check if colorScale is in [[level, color], ...] format (non-normalized)
    // This is detected when the first value is NOT close to 0 or 1
    var firstVal = colorScale[0][0];
    var lastVal = colorScale[colorScale.length - 1][0];
    var isNormalizedFormat = (firstVal >= 0 && firstVal <= 1 && lastVal >= 0 && lastVal <= 1);

    if (!isNormalizedFormat) {
        // colorScale is in [[level, color], ...] format - use SEGMENTED mapping
        // Each contour level gets the color of the segment it belongs to
        return getColorFromScaleSegmented(level, colorScale);
    }

    // Original logic for [[0, color], ...] normalized format - uses linear interpolation
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

    if (!paths || paths.length === 0) return;

    var width = style.width || ctx.canvas.width;
    var height = style.height || ctx.canvas.height;
    var smoothing = style.smoothing || 0;
    var perimeter = createPerimeter(style);

    // Validate perimeter and its elements
    if (!perimeter || !Array.isArray(perimeter) || perimeter.length < 4) {
        console.warn('drawFilledPaths: Invalid perimeter structure');
        return;
    }

    // Check all perimeter points are valid arrays
    var validPerimeter = perimeter.every(function(pt) {
        return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (!validPerimeter) {
        console.warn('drawFilledPaths: Invalid perimeter points');
        return;
    }

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

    // NOTE: Background layer is now handled at a higher level (in renderContourLayer)
    // to ensure proper coordinate transformation during zoom/pan operations.
    // Do NOT draw background here as it would use fixed canvas coordinates.

    // Draw each contour fill layer (LOWEST to HIGHEST)
    // Key insight: Each layer fills from boundary (or previous contour) to current contour
    // Layer 0 (prefixBoundary=true): fills boundary -> contour 0 with color 0
    // Layer 1 (prefixBoundary=true): fills boundary -> contour 1 with color 1 (covers layer 0's inner part)
    // So the visible colors are:
    //   - boundary -> contour 0: color 0
    //   - contour 0 -> contour 1: color 1 (because layer 1 covers layer 0 in this region)
    //   - contour 1 -> contour 2: color 2
    // etc.

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // All levels use their normal colors from colorScale
        // Null regions are handled by clip mask, not by changing fill colors
        var fillColor = getColorForLevel(pathInfo.level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);
        ctx.fillStyle = fillColor;

        // Create boundary path using DATA coordinates, then transform to canvas coordinates
        var dataPerimeter = createDataPerimeter(style);
        var boundaryPath = 'M' + dataPerimeter.map(function(pt) {
            var canvasPt = scalePoint(style, pt);
            return canvasPt.join(' ');
        }).join('L') + 'Z';
        var joinedPaths = joinAllPaths(pathInfo, perimeter, style);
        var fullpath = pathInfo.prefixBoundary ? (boundaryPath + joinedPaths) : joinedPaths;

        // Draw path with fill only
        // NOTE: Contour lines are drawn separately via drawStrokePaths to avoid
        // drawing boundary connection lines that are part of joinAllPaths result
        if (fullpath) {
            ctx.beginPath();
            drawSVGPath(ctx, fullpath);
            ctx.fill();
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
    var coloring = style.coloring || 'lines';

    ctx.lineWidth = style.lineWidth || 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (!paths || paths.length === 0) {
        return;
    }

    // Determine line color strategy:
    // - For 'lines' mode: use colorScale if available (colored contour lines)
    // - For 'fill', 'fill+lines', 'heatmap' modes: use fixed dark color for contrast
    var useFixedLineColor = coloring !== 'lines';

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];

        // Set color for this level
        if (useFixedLineColor) {
            // Use fixed line color for fill modes (better contrast against fill colors)
            ctx.strokeStyle = style.lineColor || '#333';
        } else if (useColorScale) {
            // Find color for this level (for pure lines mode)
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
    if (!path || path.length < 2) return;

    // Filter out invalid points
    var validPath = path.filter(function(pt) {
        return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (validPath.length < 2) return;

    ctx.beginPath();

    var scaledPath = validPath.map(scalePoint.bind(null, style));

    // Filter out any undefined results from scalePoint
    scaledPath = scaledPath.filter(function(pt) {
        return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (scaledPath.length < 2) return;

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
    if (!path || path.length < 2) return;

    // Filter out invalid points
    var validPath = path.filter(function(pt) {
        return pt && Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (validPath.length < 2) return;

    ctx.beginPath();

    var scaledPath = validPath.map(scalePoint.bind(null, style));

    // Filter out any undefined results from scalePoint
    scaledPath = scaledPath.filter(function(pt) {
        return pt && !isNaN(pt[0]) && !isNaN(pt[1]);
    });

    if (scaledPath.length < 2) return;

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
 * Supports visibleRange for zoom/pan functionality
 * Supports drawArea for aspect ratio adjustment
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

    // Use visibleRange if provided (for interactive zoom/pan)
    // Otherwise use full data range
    var xMin, xMax, yMin, yMax;

    if (style.visibleRange) {
        xMin = style.visibleRange.xMin;
        xMax = style.visibleRange.xMax;
        yMin = style.visibleRange.yMin;
        yMax = style.visibleRange.yMax;
    } else {
        // Get data range
        xMin = (x && x.length > 0) ? Math.min.apply(Math, x) : 0;
        xMax = (x && x.length > 0) ? Math.max.apply(Math, x) : 10;
        yMin = (y && y.length > 0) ? Math.min.apply(Math, y) : 0;
        yMax = (y && y.length > 0) ? Math.max.apply(Math, y) : 10;
    }

    // Avoid division by zero
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    // If drawArea is provided (for aspect ratio adjustment), use it
    // Otherwise fall back to padding-based calculation
    var canvasX, canvasY;

    if (style.drawArea) {
        var drawArea = style.drawArea;
        // Map data to adjusted drawing area
        canvasX = drawArea.x + ((pt[0] - xMin) / xRange) * drawArea.width;
        canvasY = drawArea.y + drawArea.height - ((pt[1] - yMin) / yRange) * drawArea.height;
    } else {
        // Legacy calculation using padding
        var width = style.width || 500;
        var height = style.height || 400;
        // Support both number and object format for padding
        var padding = normalizePadding(style.padding, 30);

        // Normalize to [0, 1] and scale to canvas
        canvasX = padding.left + ((pt[0] - xMin) / xRange) * (width - padding.left - padding.right);
        canvasY = padding.top + ((pt[1] - yMin) / yRange) * (height - padding.top - padding.bottom);

        // Flip Y axis (canvas Y increases downward)
        canvasY = height - padding.bottom - (canvasY - padding.top);
    }

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
