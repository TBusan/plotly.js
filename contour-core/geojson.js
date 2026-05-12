'use strict';

/**
 * GeoJSON export module for contour-core
 * Converts contour computation results to GeoJSON format
 *
 * Supports:
 * - LineString for line contours (lines mode)
 * - Polygon for filled contours (fill mode)
 * - Smooth path interpolation (Catmull-Rom)
 * - Coordinate transform (grid -> geographic)
 * - CRS declaration
 */

var CatmullRomExp = 0.5;

// ==============================
// Smoothing utilities
// ==============================

function smoothClosedCoords(pts, smoothness) {
    if (!pts || pts.length < 3) return pts;
    if (smoothness <= 0) return pts;

    var result = [];
    var n = pts.length;
    var tangents = [];

    for (var i = 0; i < n; i++) {
        var prev = pts[(i - 1 + n) % n];
        var curr = pts[i];
        var next = pts[(i + 1) % n];
        tangents.push(makeTangent(prev, curr, next, smoothness));
    }

    for (var i = 0; i < n; i++) {
        var nextI = (i + 1) % n;
        var steps = Math.max(1, Math.round(smoothness * 4));
        for (var s = 0; s < steps; s++) {
            var t = s / steps;
            var t1 = tangents[i][1];
            var t2 = tangents[nextI][0];
            var x = Math.pow(1 - t, 3) * curr[0] +
                    3 * Math.pow(1 - t, 2) * t * t1[0] +
                    3 * (1 - t) * t * t * t2[0] +
                    Math.pow(t, 3) * pts[nextI][0];
            var y = Math.pow(1 - t, 3) * curr[1] +
                    3 * Math.pow(1 - t, 2) * t * t1[1] +
                    3 * (1 - t) * t * t * t2[1] +
                    Math.pow(t, 3) * pts[nextI][1];
            result.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
        }
    }

    return result;
}

function smoothOpenCoords(pts, smoothness) {
    if (!pts || pts.length < 3) return pts;
    if (smoothness <= 0) return pts;

    var result = [];
    var tangents = [];

    for (var i = 1; i < pts.length - 1; i++) {
        tangents.push(makeTangent(pts[i - 1], pts[i], pts[i + 1], smoothness));
    }

    result.push([pts[0][0], pts[0][1]]);

    for (var i = 0; i < tangents.length - 1; i++) {
        var nextPtIdx = i + 2;
        var steps = Math.max(1, Math.round(smoothness * 4));
        for (var s = 0; s < steps; s++) {
            var t = s / steps;
            var t1 = tangents[i][1];
            var t2 = tangents[i + 1][0];
            var x = Math.pow(1 - t, 3) * pts[i + 1][0] +
                    3 * Math.pow(1 - t, 2) * t * t1[0] +
                    3 * (1 - t) * t * t * t2[0] +
                    Math.pow(t, 3) * pts[nextPtIdx][0];
            var y = Math.pow(1 - t, 3) * pts[i + 1][1] +
                    3 * Math.pow(1 - t, 2) * t * t1[1] +
                    3 * (1 - t) * t * t * t2[1] +
                    Math.pow(t, 3) * pts[nextPtIdx][1];
            result.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
        }
    }

    result.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
    return result;
}

function makeTangent(prevpt, thispt, nextpt, smoothness) {
    var d1x = prevpt[0] - thispt[0];
    var d1y = prevpt[1] - thispt[1];
    var d2x = nextpt[0] - thispt[0];
    var d2y = nextpt[1] - thispt[1];
    var d1a = Math.pow(d1x * d1x + d1y * d1y, CatmullRomExp / 2);
    var d2a = Math.pow(d2x * d2x + d2y * d2y, CatmullRomExp / 2);
    var numx = (d2a * d2a * d1x - d1a * d1a * d2x) * smoothness;
    var numy = (d2a * d2a * d1y - d1a * d1a * d2y) * smoothness;
    var denom1 = 3 * d2a * (d1a + d2a);
    var denom2 = 3 * d1a * (d1a + d2a);
    return [
        [
            thispt[0] + (denom1 && numx / denom1 || 0),
            thispt[1] + (denom1 && numy / denom1 || 0)
        ],
        [
            thispt[0] - (denom2 && numx / denom2 || 0),
            thispt[1] - (denom2 && numy / denom2 || 0)
        ]
    ];
}

// ==============================
// Tolerance calculation
// ==============================

function computeTolerance(bounds) {
    if (!bounds) return 1e-10;
    var rangeX = (bounds.maxX || 0) - (bounds.minX || 0);
    var rangeY = (bounds.maxY || 0) - (bounds.minY || 0);
    return Math.max(1e-10, Math.max(rangeX, rangeY) * 0.001);
}

// ==============================
// Main export functions
// ==============================

/**
 * Convert contour result to GeoJSON FeatureCollection
 *
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Export options
 * @param {String} options.type - 'lines' for LineString, 'fill' for Polygon (default: 'lines')
 * @param {String} options.propertyName - Property name for the level value (default: 'value')
 * @param {Boolean} options.includeEdgePaths - Include edge paths in output (default: true)
 * @param {Boolean} options.separateFeatures - Create separate features for each path (default: false)
 * @param {Object} options.bounds - Optional bounds to constrain output [minX, minY, maxX, maxY]
 * @param {Number} options.smooth - Smoothing factor 0-1 (default: 0, no smoothing)
 * @param {Object} options.transform - Coordinate transform { forward: function(x, y): [x', y'] }
 * @param {Object} options.crs - CRS declaration to add to FeatureCollection
 * @returns {Object} GeoJSON FeatureCollection
 */
function toGeoJSON(result, options) {
    if (!result || !result.paths) {
        throw new Error('Invalid contour result: missing paths');
    }

    options = options || {};
    var type = options.type || 'lines';
    var propertyName = options.propertyName || 'value';
    var includeEdgePaths = options.includeEdgePaths !== false;
    var separateFeatures = options.separateFeatures || false;
    var bounds = options.bounds;

    var features = [];

    for (var i = 0; i < result.paths.length; i++) {
        var pathInfo = result.paths[i];
        var level = result.levels[i];

        if (pathInfo.paths) {
            for (var j = 0; j < pathInfo.paths.length; j++) {
                var path = pathInfo.paths[j];
                var coords = convertPathCoordinates(path, options);

                if (coords.length < 2) continue;

                if (bounds && !isPathInBounds(coords, bounds)) {
                    continue;
                }

                if (type === 'fill') {
                    features.push({
                        type: 'Feature',
                        properties: createProperties(level, propertyName, 'polygon', i, j, true),
                        geometry: {
                            type: 'Polygon',
                            coordinates: [closeRing(coords)]
                        }
                    });
                } else {
                    features.push({
                        type: 'Feature',
                        properties: createProperties(level, propertyName, 'linestring', i, j, true),
                        geometry: {
                            type: 'LineString',
                            coordinates: coords
                        }
                    });
                }
            }
        }

        if (includeEdgePaths && pathInfo.edgepaths) {
            for (var k = 0; k < pathInfo.edgepaths.length; k++) {
                var edgePath = pathInfo.edgepaths[k];
                var edgeCoords = convertPathCoordinates(edgePath, options);

                if (edgeCoords.length < 2) continue;

                if (bounds && !isPathInBounds(edgeCoords, bounds)) {
                    continue;
                }

                if (type === 'fill') {
                    continue;
                } else {
                    features.push({
                        type: 'Feature',
                        properties: createProperties(level, propertyName, 'linestring_edge', i, k, false),
                        geometry: {
                            type: 'LineString',
                            coordinates: edgeCoords
                        }
                    });
                }
            }
        }
    }

    if (!separateFeatures && type === 'fill') {
        features = groupFeaturesByLevel(features, propertyName);
    }

    var fc = {
        type: 'FeatureCollection',
        features: features
    };

    if (options.crs) {
        fc.crs = options.crs;
    }

    return fc;
}

/**
 * Export filled contours as GeoJSON
 * Each level produces Polygon features with exterior rings and optional holes.
 *
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Export options
 * @param {String} options.propertyName - Property name for the level value (default: 'value')
 * @param {Number} options.smooth - Smoothing factor 0-1 (default: 0)
 * @param {Object} options.transform - Coordinate transform { forward: function(x, y): [x', y'] }
 * @param {Object} options.crs - CRS declaration to add to FeatureCollection
 * @returns {Object} GeoJSON FeatureCollection with filled polygons
 */
function toFilledGeoJSON(result, options) {
    if (!result || !result.paths) {
        throw new Error('Invalid contour result: missing paths');
    }

    options = options || {};
    var propertyName = options.propertyName || 'value';

    var features = [];
    var levels = result.levels;
    var paths = result.paths;

    var dataBounds = getDataBounds(result);
    if (!dataBounds) {
        dataBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    var tol = computeTolerance(dataBounds);
    var perimeter = createPerimeter(dataBounds);

    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var level = levels[i];

        var boundaries = buildLevelBoundary(pathInfo, perimeter, dataBounds, tol, options);

        // Build next-level boundaries as potential holes
        var nextBoundaries = null;
        if (i + 1 < paths.length) {
            nextBoundaries = buildLevelBoundary(paths[i + 1], perimeter, dataBounds, tol, options);
        }

        for (var j = 0; j < boundaries.length; j++) {
            var exteriorRing = boundaries[j];
            if (exteriorRing.length < 4) continue;

            var rings = [exteriorRing];

            // Next-level boundaries that are fully inside this ring become holes
            if (nextBoundaries) {
                for (var k = 0; k < nextBoundaries.length; k++) {
                    var innerRing = nextBoundaries[k];
                    if (innerRing.length > 0 && isPointInPolygon(innerRing[0], exteriorRing)) {
                        rings.push(innerRing);
                    }
                }
            }

            features.push({
                type: 'Feature',
                properties: {
                    value: level,
                    level: level,
                    levelIndex: i,
                    type: 'filled_contour',
                    hasHoles: rings.length > 1,
                    polygonIndex: j
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: rings
                }
            });
        }
    }

    var fc = {
        type: 'FeatureCollection',
        features: features
    };

    if (options.crs) {
        fc.crs = options.crs;
    }

    return fc;
}

// ==============================
// Boundary building
// ==============================

function buildLevelBoundary(pathInfo, perimeter, bounds, tol, options) {
    var boundaries = [];
    var edgepaths = pathInfo.edgepaths || [];
    var closedPaths = pathInfo.paths || [];

    // Create tolerance-aware edge check closures
    var minX = bounds.minX, maxX = bounds.maxX;
    var minY = bounds.minY, maxY = bounds.maxY;

    function isTop(pt) {
        return Math.abs(pt[1] - maxY) < tol;
    }
    function isBottom(pt) {
        return Math.abs(pt[1] - minY) < tol;
    }
    function isLeft(pt) {
        return Math.abs(pt[0] - minX) < tol;
    }
    function isRight(pt) {
        return Math.abs(pt[0] - maxX) < tol;
    }

    // Corner indices: perimeter = [bottomLeft, bottomRight, topRight, topLeft]
    // 0=bottomLeft, 1=bottomRight, 2=topRight, 3=topLeft
    // Clockwise from bottom-left: bottom-left -> bottom-right -> top-right -> topLeft

    // Collect valid edge paths with their coordinates
    var remainingEdges = [];
    for (var i = 0; i < edgepaths.length; i++) {
        if (edgepaths[i] && edgepaths[i].length > 0) {
            remainingEdges.push({
                index: i,
                coords: convertPathCoordinates(edgepaths[i], options)
            });
        }
    }

    if (pathInfo.prefixBoundary && remainingEdges.length === 0) {
        // Entire perimeter is the boundary
        boundaries.push([
            [perimeter[0][0], perimeter[0][1]],
            [perimeter[1][0], perimeter[1][1]],
            [perimeter[2][0], perimeter[2][1]],
            [perimeter[3][0], perimeter[3][1]],
            [perimeter[0][0], perimeter[0][1]]
        ]);
    } else if (pathInfo.prefixBoundary) {
        // prefixBoundary with edge paths: start with full perimeter, then subtract
        // This means the fill area is outside the contour lines
        var ring = [
            [perimeter[0][0], perimeter[0][1]],
            [perimeter[1][0], perimeter[1][1]],
            [perimeter[2][0], perimeter[2][1]],
            [perimeter[3][0], perimeter[3][1]],
            [perimeter[0][0], perimeter[0][1]]
        ];
        boundaries.push(ring);
    }

    // Connect edge paths along the boundary to form closed rings
    // Strategy: pick an unvisited edge path, follow it, then walk along the
    // boundary until we find the start of the next edge path, and so on until loop closes.
    var visited = new Array(remainingEdges.length);
    for (var v = 0; v < visited.length; v++) visited[v] = false;

    for (var startIdx = 0; startIdx < remainingEdges.length; startIdx++) {
        if (visited[startIdx]) continue;

        var currentRing = [];
        var startEdge = remainingEdges[startIdx];
        visited[startIdx] = true;

        // Add this edge path's points
        for (var p = 0; p < startEdge.coords.length; p++) {
            currentRing.push(startEdge.coords[p]);
        }

        var endPt = startEdge.coords[startEdge.coords.length - 1];
        var ringStartPt = startEdge.coords[0];

        // Walk along boundary to find the next edge path
        var foundComplete = false;
        var maxSteps = remainingEdges.length * 4 + 10;

        for (var step = 0; step < maxSteps && !foundComplete; step++) {
            // Check if endPt is close enough to ringStartPt to close the ring
            if (currentRing.length > 0 &&
                Math.abs(endPt[0] - ringStartPt[0]) < tol &&
                Math.abs(endPt[1] - ringStartPt[1]) < tol) {
                // Close the ring
                foundComplete = true;
                break;
            }

            // Find next edge path starting on the boundary segment after endPt
            var nextCorner = getNextCornerCW(endPt, perimeter, isTop, isRight, isBottom, isLeft);
            var foundNext = false;

            for (var ni = 0; ni < remainingEdges.length; ni++) {
                if (visited[ni]) continue;
                var nextEdge = remainingEdges[ni];
                var nextStart = nextEdge.coords[0];

                // Check if nextStart is on the boundary segment from endPt to nextCorner
                if (isOnBoundarySegment(nextStart, endPt, nextCorner, tol)) {
                    // Add boundary segment from endPt to nextStart
                    addBoundarySegment(currentRing, endPt, nextStart, perimeter, isTop, isRight, isBottom, isLeft, tol);

                    // Add this edge path's coordinates
                    for (var p = 0; p < nextEdge.coords.length; p++) {
                        currentRing.push(nextEdge.coords[p]);
                    }

                    endPt = nextEdge.coords[nextEdge.coords.length - 1];
                    visited[ni] = true;
                    foundNext = true;
                    break;
                }
            }

            if (!foundNext) {
                // No edge path starts on this segment; advance to next corner
                addCornerToRing(currentRing, endPt, nextCorner, perimeter, isTop, isRight, isBottom, isLeft, tol);
                endPt = nextCorner;
            }
        }

        // Close ring
        if (currentRing.length > 2) {
            closeRingCoords(currentRing);
            boundaries.push(currentRing);
        }
    }

    // Add interior closed paths as separate rings
    for (var k = 0; k < closedPaths.length; k++) {
        if (!closedPaths[k] || closedPaths[k].length < 3) continue;
        var closedCoords = convertPathCoordinates(closedPaths[k], options);
        if (closedCoords.length < 3) continue;
        closeRingCoords(closedCoords);
        boundaries.push(closedCoords);
    }

    return boundaries;
}

function getNextCornerCW(pt, perimeter, isTop, isRight, isBottom, isLeft) {
    // Clockwise: bottom → right → top → left
    if (isBottom(pt) && !isRight(pt)) return perimeter[1]; // bottom edge → bottom-right corner
    if (isRight(pt) && !isTop(pt)) return perimeter[2];     // right edge → top-right corner
    if (isTop(pt) && !isLeft(pt)) return perimeter[3];      // top edge → top-left corner
    if (isLeft(pt) && !isBottom(pt)) return perimeter[0];   // left edge → bottom-left corner
    // At a corner - move to next corner clockwise
    if (isBottom(pt) && isRight(pt)) return perimeter[2];
    if (isRight(pt) && isTop(pt)) return perimeter[3];
    if (isTop(pt) && isLeft(pt)) return perimeter[0];
    if (isLeft(pt) && isBottom(pt)) return perimeter[1];
    return perimeter[1];
}

function addBoundarySegment(ring, fromPt, toPt, perimeter, isTop, isRight, isBottom, isLeft, tol) {
    // If fromPt and toPt are the same point (within tolerance), do nothing
    if (Math.abs(fromPt[0] - toPt[0]) < tol && Math.abs(fromPt[1] - toPt[1]) < tol) {
        return;
    }

    // Walk along boundary from fromPt clockwise until reaching toPt
    var currentPt = fromPt;
    var maxSteps = 8; // At most go around 8 corners

    for (var step = 0; step < maxSteps; step++) {
        var nextCorner = getNextCornerCW(currentPt, perimeter, isTop, isRight, isBottom, isLeft);

        // Check if toPt is on the segment from currentPt to nextCorner
        if (isOnBoundarySegment(toPt, currentPt, nextCorner, tol)) {
            // Add toPt if it's not the same as the last point in the ring
            var lastRing = ring[ring.length - 1];
            if (!lastRing || Math.abs(toPt[0] - lastRing[0]) > tol || Math.abs(toPt[1] - lastRing[1]) > tol) {
                ring.push([toPt[0], toPt[1]]);
            }
            return;
        }

        // Add the corner to the ring
        var lastRing2 = ring[ring.length - 1];
        if (!lastRing2 || Math.abs(nextCorner[0] - lastRing2[0]) > tol || Math.abs(nextCorner[1] - lastRing2[1]) > tol) {
            ring.push([nextCorner[0], nextCorner[1]]);
        }
        currentPt = nextCorner;
    }
}

function addCornerToRing(ring, currentPt, corner, perimeter, isTop, isRight, isBottom, isLeft, tol) {
    var lastPt = ring[ring.length - 1];
    if (!lastPt || Math.abs(corner[0] - lastPt[0]) > tol || Math.abs(corner[1] - lastPt[1]) > tol) {
        ring.push([corner[0], corner[1]]);
    }
}

function isOnBoundarySegment(pt, segStart, segEnd, tol) {
    if (!pt || !segStart || !segEnd) return false;

    // Check if two points have same x (vertical segment from bottom to top)
    if (Math.abs(segStart[0] - segEnd[0]) < tol) {
        if (Math.abs(pt[0] - segStart[0]) < tol) {
            var yMin = Math.min(segStart[1], segEnd[1]);
            var yMax = Math.max(segStart[1], segEnd[1]);
            return pt[1] >= yMin - tol && pt[1] <= yMax + tol;
        }
        return false;
    }

    // Check if two points have same y (horizontal segment from left to right)
    if (Math.abs(segStart[1] - segEnd[1]) < tol) {
        if (Math.abs(pt[1] - segStart[1]) < tol) {
            var xMin = Math.min(segStart[0], segEnd[0]);
            var xMax = Math.max(segStart[0], segEnd[0]);
            return pt[0] >= xMin - tol && pt[0] <= xMax + tol;
        }
        return false;
    }

    return false;
}

// ==============================
// Utilities
// ==============================

function closeRingCoords(coords) {
    if (coords.length < 3) return;
    var first = coords[0];
    var last = coords[coords.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-10 || Math.abs(first[1] - last[1]) > 1e-10) {
        coords.push([first[0], first[1]]);
    }
}

function closeRing(coords) {
    if (coords.length < 2) return coords;
    var result = coords.slice();
    var first = result[0];
    var last = result[result.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-10 || Math.abs(first[1] - last[1]) > 1e-10) {
        result.push([first[0], first[1]]);
    }
    return result;
}

function createPerimeter(bounds) {
    return [
        [bounds.minX, bounds.minY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
        [bounds.minX, bounds.maxY]
    ];
}

function getDataBounds(result) {
    if (result.pathinfo && result.pathinfo.length > 0) {
        var pi = result.pathinfo[0];
        if (pi.x && pi.y) {
            return {
                minX: pi.x[0],
                maxX: pi.x[pi.x.length - 1],
                minY: pi.y[0],
                maxY: pi.y[pi.y.length - 1]
            };
        }
    }

    // Fallback: infer from path coordinates
    if (result.paths && result.paths.length > 0) {
        var minX = Infinity, maxX = -Infinity;
        var minY = Infinity, maxY = -Infinity;

        for (var i = 0; i < result.paths.length; i++) {
            var p = result.paths[i];
            var allPaths = (p.paths || []).concat(p.edgepaths || []);
            for (var j = 0; j < allPaths.length; j++) {
                var path = allPaths[j];
                for (var k = 0; k < path.length; k++) {
                    var pt = path[k];
                    if (pt && pt.length >= 2) {
                        if (pt[0] < minX) minX = pt[0];
                        if (pt[0] > maxX) maxX = pt[0];
                        if (pt[1] < minY) minY = pt[1];
                        if (pt[1] > maxY) maxY = pt[1];
                    }
                }
            }
        }

        if (isFinite(minX)) {
            return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
        }
    }

    return null;
}

function convertPathCoordinates(path, options) {
    options = options || {};
    var coords = [];

    for (var i = 0; i < path.length; i++) {
        var pt = path[i];
        if (Array.isArray(pt) && pt.length >= 2) {
            var x = pt[0];
            var y = pt[1];

            if (options.transform && typeof options.transform.forward === 'function') {
                var transformed = options.transform.forward(x, y);
                x = transformed[0];
                y = transformed[1];
            }

            coords.push([x, y]);
        }
    }

    // Apply smoothing if requested
    if (options.smooth && options.smooth > 0) {
        var isClosed = coords.length > 2 &&
            Math.abs(coords[0][0] - coords[coords.length - 1][0]) < 1e-10 &&
            Math.abs(coords[0][1] - coords[coords.length - 1][1]) < 1e-10;

        if (isClosed) {
            coords = smoothClosedCoords(coords, options.smooth);
        } else {
            coords = smoothOpenCoords(coords, options.smooth);
        }
    }

    return coords;
}

function createProperties(level, propertyName, geomType, levelIndex, pathIndex, isClosed) {
    var props = {};
    props[propertyName] = level;
    props.level = level;
    props.levelIndex = levelIndex;
    props.pathIndex = pathIndex;
    props.type = geomType;
    props.closed = isClosed;
    return props;
}

function isPathInBounds(coords, bounds) {
    var minX = bounds[0], minY = bounds[1], maxX = bounds[2], maxY = bounds[3];
    for (var i = 0; i < coords.length; i++) {
        var x = coords[i][0];
        var y = coords[i][1];
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return true;
        }
    }
    return false;
}

function groupFeaturesByLevel(features, propertyName) {
    var grouped = {};

    for (var i = 0; i < features.length; i++) {
        var feat = features[i];
        var level = feat.properties[propertyName];
        var key = String(level);

        if (!grouped[key]) {
            grouped[key] = {
                properties: feat.properties,
                geometries: []
            };
        }

        grouped[key].geometries.push(feat.geometry);
    }

    var result = [];

    for (var key in grouped) {
        var group = grouped[key];
        var geomType = group.geometries[0].type;

        if (geomType === 'LineString') {
            result.push({
                type: 'Feature',
                properties: group.properties,
                geometry: {
                    type: 'MultiLineString',
                    coordinates: group.geometries.map(function(g) { return g.coordinates; })
                }
            });
        } else if (geomType === 'Polygon') {
            result.push({
                type: 'Feature',
                properties: group.properties,
                geometry: {
                    type: 'MultiPolygon',
                    coordinates: group.geometries.map(function(g) { return g.coordinates; })
                }
            });
        }
    }

    return result;
}

function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;

    var x = point[0];
    var y = point[1];
    var inside = false;

    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i][0];
        var yi = polygon[i][1];
        var xj = polygon[j][0];
        var yj = polygon[j][1];

        var intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}

function stringify(result, options) {
    var geojson;
    if (options && options.type === 'fill') {
        geojson = toFilledGeoJSON(result, options);
    } else {
        geojson = toGeoJSON(result, options);
    }
    return JSON.stringify(geojson, null, (options && options.indent) || 2);
}

module.exports = {
    toGeoJSON: toGeoJSON,
    stringify: stringify,
    toFilledGeoJSON: toFilledGeoJSON
};