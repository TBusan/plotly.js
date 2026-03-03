'use strict';

/**
 * ZRender path utilities for contour rendering
 * Using same rendering logic as canvas renderer for proper fill ordering
 */

var zrender = require('zrender');
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
 * Same logic as canvas renderer
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var allPoints = [];  // Array of point arrays for CompoundPath
    var edgepaths = pathInfo.edgepaths || [];
    var paths = pathInfo.paths || [];

    if (edgepaths.length === 0 && paths.length === 0) {
        return allPoints;
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, i) { return i; });
    var newloop = true;
    var endpt;
    var newendpt;
    var cnt;
    var nexti;
    var possiblei;
    var currentLoopPoints = [];

    function istop(pt) {
        if (!pt || !perimeter || !perimeter[0]) return false;
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
    }
    function isbottom(pt) {
        if (!pt || !perimeter || !perimeter[2]) return false;
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
    }
    function isleft(pt) {
        if (!pt || !perimeter || !perimeter[0]) return false;
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
    }
    function isright(pt) {
        if (!pt || !perimeter || !perimeter[2]) return false;
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
    }

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

        // Scale points
        var scaledPath = currentPath.map(function(pt) {
            return scalePoint(style, pt);
        });

        // Add to current loop
        if (newloop) {
            if (currentLoopPoints.length > 0) {
                allPoints.push(currentLoopPoints);
            }
            currentLoopPoints = [];
        }
        currentLoopPoints = currentLoopPoints.concat(scaledPath);

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

            // Add corner point if no path found
            if (nexti < 0) {
                if (newendpt) {
                    currentLoopPoints.push(newendpt);
                }
            }
            if (!newendpt) break;
            endpt = newendpt;
            if (nexti >= 0) break;
        }

        if (nexti === edgepaths.length || nexti < 0) break;

        i = nexti;
        newloop = (startsleft.indexOf(i) === -1);
        if (newloop && startsleft.length > 0) {
            i = startsleft[0];
        }
    }

    // Add final loop
    if (currentLoopPoints.length > 0) {
        allPoints.push(currentLoopPoints);
    }

    // Add interior closed paths
    var interiorPaths = pathInfo.paths || [];
    for (i = 0; i < interiorPaths.length; i++) {
        if (!interiorPaths[i] || !Array.isArray(interiorPaths[i]) ||
            interiorPaths[i].length === 0) {
            continue;
        }
        var scaledPath = interiorPaths[i].map(function(pt) {
            return scalePoint(style, pt);
        });
        allPoints.push(scaledPath);
    }

    return allPoints;
}

/**
 * Interpolate between two hex colors
 */
function interpolateColor(color1, color2, t) {
    var r1 = parseInt(color1.slice(1, 3), 16);
    var g1 = parseInt(color1.slice(3, 5), 16);
    var b1 = parseInt(color1.slice(5, 7), 16);

    var r2 = parseInt(color2.slice(1, 3), 16);
    var g2 = parseInt(color2.slice(3, 5), 16);
    var b2 = parseInt(color2.slice(5, 7), 16);

    t = Math.max(0, Math.min(1, t));

    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);

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
 */
function getColorForSegmentedValue(value, valueColorMap) {
    if (!valueColorMap || !Array.isArray(valueColorMap) || valueColorMap.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    if (value < valueColorMap[0][0]) {
        return valueColorMap[0][1];
    }

    for (var i = 0; i < valueColorMap.length - 1; i++) {
        if (value >= valueColorMap[i][0] && value < valueColorMap[i + 1][0]) {
            return valueColorMap[i][1];
        }
    }

    return valueColorMap[valueColorMap.length - 1][1];
}

/**
 * Get color for a contour level
 */
function getColorForLevel(level, levelIndex, levels, colorScale, hasCustomLevels, stepSize, valueColorMap) {
    // PRIORITY 1: Use valueColorMap (segmented color mapping) if provided
    if (valueColorMap && Array.isArray(valueColorMap) && valueColorMap.length > 0) {
        var segmentValue;
        if (levelIndex < valueColorMap.length - 1) {
            segmentValue = (valueColorMap[levelIndex][0] + valueColorMap[levelIndex + 1][0]) / 2;
        } else if (levelIndex === valueColorMap.length - 1) {
            segmentValue = valueColorMap[levelIndex][0] + 1;
        } else {
            segmentValue = level;
        }
        return getColorForSegmentedValue(segmentValue, valueColorMap);
    }

    if (!colorScale || colorScale.length === 0) {
        return 'rgba(100, 100, 100, 0.5)';
    }

    if (!levels || levels.length === 0) {
        return colorScale[0][1] || 'rgba(100, 100, 100, 0.5)';
    }

    var firstVal = colorScale[0][0];

    // If first value is close to the first level, assume [[level, color], ...] format
    if (Math.abs(firstVal - levels[0]) < Math.abs(firstVal) + 0.1) {
        for (var i = 0; i < colorScale.length; i++) {
            if (Math.abs(colorScale[i][0] - level) < 0.01) {
                return colorScale[i][1];
            }
        }

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
 * Scale point from DATA SPACE to CANVAS coordinates
 */
function scalePoint(style, pt) {
    if (!pt || !Array.isArray(pt) || pt.length < 2) {
        return [0, 0];
    }

    if (isNaN(pt[0]) || isNaN(pt[1])) {
        return [0, 0];
    }

    var x = style.x || [];
    var y = style.y || [];
    var width = style.width || 500;
    var height = style.height || 400;
    var padding = style.padding || 30;

    var xMin = (x && x.length > 0) ? Math.min.apply(Math, x) : 0;
    var xMax = (x && x.length > 0) ? Math.max.apply(Math, x) : 10;
    var yMin = (y && y.length > 0) ? Math.min.apply(Math, y) : 0;
    var yMax = (y && y.length > 0) ? Math.max.apply(Math, y) : 10;

    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;

    var canvasX = padding + ((pt[0] - xMin) / xRange) * (width - 2 * padding);
    var canvasY = padding + ((pt[1] - yMin) / yRange) * (height - 2 * padding);

    canvasY = height - padding - (canvasY - padding);

    return [canvasX, canvasY];
}

/**
 * Scale a point from grid coordinates to canvas coordinates
 */
function scalePointData(pt, n, m, width, height, padding) {
    var scaleX = (width - 2 * padding) / (n - 1);
    var scaleY = (height - 2 * padding) / (m - 1);

    return {
        x: padding + pt.x * scaleX,
        y: padding + (m - 1 - pt.y) * scaleY
    };
}

/**
 * Convert array [x, y] to object {x, y} for zrender
 */
function arrayToObject(pt) {
    return { x: pt[0], y: pt[1] };
}

/**
 * Create a Polygon element from points array
 */
function createPolygonElement(points, color, style, isBackground) {
    if (!points || points.length === 0) {
        return null;
    }

    return new zrender.Polygon({
        shape: {
            points: points,
            smooth: isBackground ? 0 : (style.smoothing || 0)
        },
        style: {
            fill: color,
            stroke: isBackground ? 'none' : (style.lineColor || '#666'),
            lineWidth: isBackground ? 0 : (style.lineWidth || 1.5),
            opacity: style.opacity !== undefined ? style.opacity : 1,
            lineJoin: 'round',
            lineCap: 'round'
        },
        silent: isBackground
    });
}

/**
 * Create background rect element
 */
function createBackgroundRect(perimeter, color, style) {
    return new zrender.Rect({
        shape: {
            x: perimeter[0][0],
            y: perimeter[0][1],
            width: perimeter[1][0] - perimeter[0][0],
            height: perimeter[2][1] - perimeter[0][1]
        },
        style: {
            fill: color,
            stroke: 'none',
            opacity: style.opacity !== undefined ? style.opacity : 1
        },
        silent: true
    });
}

/**
 * Create all contour path elements
 * Uses same rendering logic as canvas renderer:
 * 1. Draw background layer first
 * 2. Draw each contour level from lowest to highest
 * 3. Each level uses joined paths with proper boundary handling
 */
function createContourPaths(result, style, options) {
    var elements = [];
    var paths = result.paths;
    var levels = result.levels;

    if (!paths || paths.length === 0) {
        return elements;
    }

    var perimeter = createPerimeter(style);
    var hasCustomLevels = style.thresholds && Array.isArray(style.thresholds);
    var stepSize = (!hasCustomLevels && levels.length > 1) ? levels[1] - levels[0] : 0;
    var colorScale = style.colorScale;
    var valueColorMap = style.valueColorMap;

    // 1. Create background layer
    var bgColor;
    if (valueColorMap) {
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

    // Add background rect
    var bgRect = createBackgroundRect(perimeter, bgColor, style);
    if (bgRect) {
        elements.push({
            element: bgRect,
            level: null,
            index: -1,
            type: 'background'
        });
    }

    // 2. Draw each contour fill layer (LOWEST to HIGHEST)
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var level = pathInfo.level;

        // Get color for this level
        var fillColor = getColorForLevel(level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);

        // Join all paths for this level (same logic as canvas renderer)
        var allPathPoints = joinAllPaths(pathInfo, perimeter, style);

        // Add boundary path if needed (prefixBoundary)
        if (pathInfo.prefixBoundary) {
            // Add perimeter as first path
            allPathPoints.unshift(perimeter.slice());
        }

        // Create a single compound path for this level
        if (allPathPoints.length > 0) {
            // Use CompoundPath for multiple sub-paths
            var compoundPath = new zrender.CompoundPath({
                shape: {
                    paths: allPathPoints.map(function(pts) {
                        return new zrender.Polygon({
                            shape: {
                                points: pts,
                                smooth: style.smoothing || 0
                            }
                        });
                    })
                },
                style: {
                    fill: fillColor,
                    stroke: style.showLines !== false ? (style.lineColor || '#666') : 'none',
                    lineWidth: style.lineWidth || 1.5,
                    opacity: style.opacity !== undefined ? style.opacity : 1,
                    lineJoin: 'round',
                    lineCap: 'round'
                },
                silent: false
            });

            elements.push({
                element: compoundPath,
                level: level,
                index: i,
                type: 'fill'
            });
        }
    }

    return elements;
}

/**
 * Update path style for hover effects
 */
function updatePathStyle(element, newStyle) {
    element.attr({
        style: newStyle
    });
}

module.exports = {
    createContourPaths: createContourPaths,
    createPolygonElement: createPolygonElement,
    updatePathStyle: updatePathStyle,
    getColorForLevel: getColorForLevel,
    scalePoint: scalePoint,
    scalePointData: scalePointData,
    arrayToObject: arrayToObject,
    createPerimeter: createPerimeter,
    joinAllPaths: joinAllPaths
};
