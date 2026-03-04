'use strict';

/**
 * Three.js path utilities for contour rendering
 * Converts contour paths to Three.js Shape and geometry
 */

// Try to get THREE from require, fall back to global
var THREE;
try {
    THREE = require('three');
} catch (e) {
    THREE = typeof window !== 'undefined' ? window.THREE : null;
}
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

    return [
        [xMin, yMin],
        [xMax, yMin],
        [xMax, yMax],
        [xMin, yMax]
    ];
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
 * Convert canvas coordinates to Three.js world coordinates
 */
function canvasToWorld(x, y, width, height) {
    // Convert from canvas (top-left origin) to Three.js world (center origin, Y up)
    return {
        x: x - width / 2,
        y: -(y - height / 2)
    };
}

/**
 * Join all edge paths into a single path with proper boundary connections
 */
function joinAllPaths(pathInfo, perimeter, style) {
    var allPoints = [];
    var edgepaths = pathInfo.edgepaths || [];
    var paths = pathInfo.paths || [];

    // Validate perimeter
    if (!perimeter || perimeter.length < 4) {
        return allPoints;
    }

    // Filter out invalid edgepaths
    edgepaths = edgepaths.filter(function(ep) {
        return ep && Array.isArray(ep) && ep.length > 0;
    });

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

    while (startsleft.length > 0) {
        var currentPath = edgepaths[i];

        if (!currentPath || !Array.isArray(currentPath) || currentPath.length === 0) {
            startsleft.splice(startsleft.indexOf(i), 1);
            if (startsleft.length > 0) {
                i = startsleft[0];
                newloop = true;
            }
            continue;
        }

        var scaledPath = currentPath.map(function(pt) {
            return scalePoint(style, pt);
        });

        if (newloop) {
            if (currentLoopPoints.length > 0) {
                allPoints.push(currentLoopPoints);
            }
            currentLoopPoints = [];
        }
        currentLoopPoints = currentLoopPoints.concat(scaledPath);

        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scalePoint(style, currentPath[currentPath.length - 1]);
        nexti = -1;

        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
            else if (isleft(endpt)) newendpt = perimeter[0];
            else if (isbottom(endpt)) newendpt = perimeter[3];
            else if (isright(endpt)) newendpt = perimeter[2];

            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                if (!edgepaths[possiblei] || !Array.isArray(edgepaths[possiblei]) ||
                    edgepaths[possiblei].length === 0 || !edgepaths[possiblei][0]) {
                    continue;
                }
                var ptNew = scalePoint(style, edgepaths[possiblei][0]);

                if (Math.abs(endpt[0] - newendpt[0]) < 0.1) {
                    if (Math.abs(endpt[0] - ptNew[0]) < 0.1 &&
                        (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endpt[1] - newendpt[1]) < 0.1) {
                    if (Math.abs(endpt[1] - ptNew[1]) < 0.1 &&
                        (ptNew[0] - endpt[0]) * (newendpt[0] - ptNew[0]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                }
            }

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

    if (currentLoopPoints.length > 0) {
        allPoints.push(currentLoopPoints);
    }

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
        return '#646464';
    }

    var n = colorScale.length;
    if (n === 0) return '#646464';
    if (n === 1) return colorScale[0][1];

    for (var i = 0; i < n - 1; i++) {
        if (value >= colorScale[i][0] && value <= colorScale[i + 1][0]) {
            var t = (value - colorScale[i][0]) / (colorScale[i + 1][0] - colorScale[i][0]);
            return interpolateColor(colorScale[i][1], colorScale[i + 1][1], t);
        }
    }

    if (value < colorScale[0][0]) return colorScale[0][1];
    if (value > colorScale[n - 1][0]) return colorScale[n - 1][1];
    return colorScale[Math.floor(n / 2)][1];
}

/**
 * Get color for a value using segmented color mapping
 */
function getColorForSegmentedValue(value, valueColorMap) {
    if (!valueColorMap || !Array.isArray(valueColorMap) || valueColorMap.length === 0) {
        return '#646464';
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
        return '#646464';
    }

    if (!levels || levels.length === 0) {
        return colorScale[0][1] || '#646464';
    }

    var firstVal = colorScale[0][0];

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
        return colorScale[0][1] || '#646464';
    }

    var normalizedValue = (value - minVal) / range;
    normalizedValue = Math.max(0, Math.min(1, normalizedValue));

    return getColorForValue(normalizedValue, colorScale);
}

/**
 * Convert hex color to THREE.Color
 */
function hexToThreeColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') {
        return new THREE.Color(0x646464);
    }

    // Handle rgba format
    if (hexColor.startsWith('rgba') || hexColor.startsWith('rgb')) {
        var match = hexColor.match(/[\d.]+/g);
        if (match && match.length >= 3) {
            return new THREE.Color(
                parseInt(match[0]) / 255,
                parseInt(match[1]) / 255,
                parseInt(match[2]) / 255
            );
        }
    }

    // Handle hex format
    var hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    return new THREE.Color(parseInt(hex, 16));
}

/**
 * Create a Three.js Shape from points array
 */
function createShapeFromPoints(points, width, height) {
    if (!points || points.length < 3) {
        return null;
    }

    var shape = new THREE.Shape();
    var firstPt = canvasToWorld(points[0][0], points[0][1], width, height);

    shape.moveTo(firstPt.x, firstPt.y);

    for (var i = 1; i < points.length; i++) {
        var pt = canvasToWorld(points[i][0], points[i][1], width, height);
        shape.lineTo(pt.x, pt.y);
    }

    shape.closePath();
    return shape;
}

/**
 * Create background plane mesh
 */
function createBackgroundMesh(perimeter, color, style, renderer) {
    var width = style.width || 500;
    var height = style.height || 400;
    var threeColor = hexToThreeColor(color);

    if (!perimeter || perimeter.length < 4 || !perimeter[0] || !perimeter[2]) {
        return null;
    }

    var worldP0 = canvasToWorld(perimeter[0][0], perimeter[0][1], width, height);
    var worldP2 = canvasToWorld(perimeter[2][0], perimeter[2][1], width, height);

    var planeWidth = worldP2.x - worldP0.x;
    var planeHeight = worldP2.y - worldP0.y;

    var geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    var material = new THREE.MeshBasicMaterial({
        color: threeColor,
        side: THREE.DoubleSide
    });

    var mesh = new THREE.Mesh(geometry, material);

    // Position at center of perimeter
    mesh.position.set(
        (worldP0.x + worldP2.x) / 2,
        (worldP0.y + worldP2.y) / 2,
        0
    );

    return mesh;
}

/**
 * Create contour fill mesh from points
 */
function createContourMesh(pointsArray, color, style, renderer) {
    if (!pointsArray || pointsArray.length === 0 || !pointsArray[0]) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var threeColor = hexToThreeColor(color);

    // Create main shape from first path
    var mainShape = createShapeFromPoints(pointsArray[0], width, height);
    if (!mainShape) return null;

    // Add holes from subsequent paths
    for (var i = 1; i < pointsArray.length; i++) {
        var holePath = new THREE.Path();
        var holePoints = pointsArray[i];
        if (!holePoints || holePoints.length < 3) continue;

        var firstHolePt = canvasToWorld(holePoints[0][0], holePoints[0][1], width, height);
        holePath.moveTo(firstHolePt.x, firstHolePt.y);

        for (var j = 1; j < holePoints.length; j++) {
            var holePt = canvasToWorld(holePoints[j][0], holePoints[j][1], width, height);
            holePath.lineTo(holePt.x, holePt.y);
        }

        holePath.closePath();
        mainShape.holes.push(holePath);
    }

    // Create geometry
    var geometry = new THREE.ShapeGeometry(mainShape);

    // Create material
    var material = new THREE.MeshBasicMaterial({
        color: threeColor,
        side: THREE.DoubleSide,
        transparent: style.opacity !== undefined && style.opacity < 1,
        opacity: style.opacity !== undefined ? style.opacity : 1
    });

    var mesh = new THREE.Mesh(geometry, material);
    return mesh;
}

/**
 * Create contour line mesh
 */
function createContourLineMesh(pointsArray, color, style, renderer) {
    if (!pointsArray || pointsArray.length === 0) {
        return null;
    }

    var width = style.width || 500;
    var height = style.height || 400;
    var threeColor = hexToThreeColor(color);
    var lineWidth = style.lineWidth || 1.5;

    var lineGeometries = [];

    for (var i = 0; i < pointsArray.length; i++) {
        var points = pointsArray[i];
        if (!points || points.length < 2) continue;

        var vertices = [];
        for (var j = 0; j < points.length; j++) {
            var worldPt = canvasToWorld(points[j][0], points[j][1], width, height);
            vertices.push(worldPt.x, worldPt.y, 0);
        }
        // Close the loop
        if (points.length > 2) {
            var firstWorldPt = canvasToWorld(points[0][0], points[0][1], width, height);
            vertices.push(firstWorldPt.x, firstWorldPt.y, 0);
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        lineGeometries.push(geometry);
    }

    if (lineGeometries.length === 0) return null;

    // Merge all line geometries
    var mergedGeometry = lineGeometries.length === 1
        ? lineGeometries[0]
        : THREE.BufferGeometryUtils
            ? THREE.BufferGeometryUtils.mergeBufferGeometries(lineGeometries)
            : lineGeometries[0]; // Fallback if utils not available

    var material = new THREE.LineBasicMaterial({
        color: threeColor,
        linewidth: lineWidth
    });

    var line = new THREE.LineLoop(mergedGeometry, material);
    return line;
}

/**
 * Create all contour path meshes
 */
function createContourPaths(result, style, renderer) {
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
    var width = style.width || 500;
    var height = style.height || 400;

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

    var bgMesh = createBackgroundMesh(perimeter, bgColor, style, renderer);
    if (bgMesh) {
        elements.push({
            mesh: bgMesh,
            level: null,
            index: -1,
            type: 'background'
        });
    }

    // 2. Draw each contour fill layer (LOWEST to HIGHEST)
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var level = pathInfo.level;

        var fillColor = getColorForLevel(level, i, levels, colorScale, hasCustomLevels, stepSize, valueColorMap);

        var allPathPoints = joinAllPaths(pathInfo, perimeter, style);

        if (pathInfo.prefixBoundary) {
            allPathPoints.unshift(perimeter.slice());
        }

        if (allPathPoints.length > 0) {
            var fillMesh = createContourMesh(allPathPoints, fillColor, style, renderer);
            if (fillMesh) {
                elements.push({
                    mesh: fillMesh,
                    level: level,
                    index: i,
                    type: 'fill'
                });
            }

            // Create contour lines if needed
            if (style.showLines !== false) {
                var lineColor = style.lineColor || '#666666';
                var lineMesh = createContourLineMesh(allPathPoints, lineColor, style, renderer);
                if (lineMesh) {
                    elements.push({
                        mesh: lineMesh,
                        level: level,
                        index: i,
                        type: 'line'
                    });
                }
            }
        }
    }

    return elements;
}

module.exports = {
    createContourPaths: createContourPaths,
    createShapeFromPoints: createShapeFromPoints,
    createContourMesh: createContourMesh,
    createContourLineMesh: createContourLineMesh,
    getColorForLevel: getColorForLevel,
    hexToThreeColor: hexToThreeColor,
    scalePoint: scalePoint,
    canvasToWorld: canvasToWorld,
    createPerimeter: createPerimeter,
    joinAllPaths: joinAllPaths
};
