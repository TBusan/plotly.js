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
// Perimeter parameterization
// ==============================

/**
 * Compute clockwise perimeter parameter for a boundary point.
 * Perimeter goes clockwise:
 *   bottom edge (left→right) → right edge (bottom→top) → top edge (right→left) → left edge (top→bottom)
 *
 * Returns t ∈ [0, 4]:
 *   bottom edge: [0, 1]  (corner at t=1 = bottom-right)
 *   right edge:  [1, 2]  (corner at t=2 = top-right)
 *   top edge:    [2, 3]  (corner at t=3 = top-left)
 *   left edge:   [3, 4]  (corner at t=4/0 = bottom-left)
 */
function perimeterParam(pt, bounds, tol) {
    var minX = bounds.minX, maxX = bounds.maxX;
    var minY = bounds.minY, maxY = bounds.maxY;
    var x = pt[0], y = pt[1];
    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;

    // Bottom edge: y=minY, x from minX→maxX → t ∈ [0, 1]
    if (Math.abs(y - minY) < tol && x >= minX - tol && x <= maxX + tol) {
        return (x - minX) / rangeX;
    }
    // Right edge: x=maxX, y from minY→maxY → t ∈ [1, 2]
    if (Math.abs(x - maxX) < tol && y >= minY - tol && y <= maxY + tol) {
        return 1 + (y - minY) / rangeY;
    }
    // Top edge: y=maxY, x from maxX→minX → t ∈ [2, 3]
    if (Math.abs(y - maxY) < tol && x >= minX - tol && x <= maxX + tol) {
        return 2 + (maxX - x) / rangeX;
    }
    // Left edge: x=minX, y from maxY→minY → t ∈ [3, 4]
    if (Math.abs(x - minX) < tol && y >= minY - tol && y <= maxY + tol) {
        return 3 + (maxY - y) / rangeY;
    }
    return -1; // Not on perimeter
}

/**
 * Walk clockwise along the perimeter from fromPt to toPt,
 * adding corner points in clockwise order. Appends points to the ring.
 */
function appendBoundaryPath(ring, fromPt, toPt, perimeter, bounds, tol) {
    if (Math.abs(fromPt[0] - toPt[0]) < tol && Math.abs(fromPt[1] - toPt[1]) < tol) {
        return;
    }

    var fromT = perimeterParam(fromPt, bounds, tol);
    var toT = perimeterParam(toPt, bounds, tol);

    // Clockwise distance from fromPt to toPt
    var deltaT = toT - fromT;
    if (deltaT <= 1e-10) deltaT += 4;

    // Collect corners between fromPt and toPt, sorted by clockwise distance
    // Corner parameters: corner 0 (bottomLeft)=t:0, corner 1 (bottomRight)=t:1,
    //                    corner 2 (topRight)=t:2, corner 3 (topLeft)=t:3
    var cornersToAdd = [];
    for (var ci = 0; ci < 4; ci++) {
        var cornerT = ci;
        var distToCorner = cornerT - fromT;
        if (distToCorner <= 1e-10) distToCorner += 4;
        if (distToCorner > 1e-10 && distToCorner < deltaT - 1e-10) {
            cornersToAdd.push({ index: ci, dist: distToCorner });
        }
    }

    // Sort by clockwise distance so corners are added in correct order
    cornersToAdd.sort(function(a, b) { return a.dist - b.dist; });

    for (var i = 0; i < cornersToAdd.length; i++) {
        var ci = cornersToAdd[i].index;
        var last = ring[ring.length - 1];
        if (!last || Math.abs(perimeter[ci][0] - last[0]) > tol || Math.abs(perimeter[ci][1] - last[1]) > tol) {
            ring.push([perimeter[ci][0], perimeter[ci][1]]);
        }
    }

    // Add toPt
    var last = ring[ring.length - 1];
    if (!last || Math.abs(toPt[0] - last[0]) > tol || Math.abs(toPt[1] - last[1]) > tol) {
        ring.push([toPt[0], toPt[1]]);
    }
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

    // Pre-compute all level boundaries
    var allBoundaries = [];
    for (var i = 0; i < paths.length; i++) {
        allBoundaries.push(buildLevelBoundary(paths[i], perimeter, dataBounds, tol, options));
    }

    for (var i = 0; i < paths.length; i++) {
        var level = levels[i];
        var boundaries = allBoundaries[i];

        for (var j = 0; j < boundaries.length; j++) {
            var exteriorRing = boundaries[j];
            if (exteriorRing.length < 4) continue;

            var rings = [exteriorRing];

            // Next-level boundaries that are fully inside this ring become holes
            if (i + 1 < allBoundaries.length) {
                var nextBoundaries = allBoundaries[i + 1];
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

/**
 * Build closed boundary rings for a contour level.
 *
 * Uses perimeter parameterization to correctly order edge paths
 * along the boundary, preventing self-intersecting polygons.
 *
 * Strategy:
 * 1. Assign each edge path start/end a parameter t ∈ [0,4) representing
 *    its position along the clockwise perimeter
 * 2. Sort edge paths by their start position
 * 3. Connect consecutive edge paths by walking clockwise along the boundary
 * 4. Interior closed paths are added as separate rings
 */
function buildLevelBoundary(pathInfo, perimeter, bounds, tol, options) {
    var boundaries = [];
    var edgepaths = pathInfo.edgepaths || [];
    var closedPaths = pathInfo.paths || [];

    // Convert edge paths to coordinate arrays
    var edges = [];
    for (var i = 0; i < edgepaths.length; i++) {
        if (edgepaths[i] && edgepaths[i].length > 0) {
            var coords = convertPathCoordinates(edgepaths[i], options);
            if (coords.length < 2) continue;
            edges.push({
                index: i,
                coords: coords
            });
        }
    }

    // prefixBoundary = true means the fill area extends to the entire perimeter.
    // Per close_boundaries.js, this is only set when edgepaths.length === 0.
    if (pathInfo.prefixBoundary && edges.length === 0) {
        boundaries.push([
            [perimeter[0][0], perimeter[0][1]],
            [perimeter[1][0], perimeter[1][1]],
            [perimeter[2][0], perimeter[2][1]],
            [perimeter[3][0], perimeter[3][1]],
            [perimeter[0][0], perimeter[0][1]]
        ]);
        // Interior closed paths at this level become separate boundary rings
        for (var k = 0; k < closedPaths.length; k++) {
            if (!closedPaths[k] || closedPaths[k].length < 3) continue;
            var closedCoords = convertPathCoordinates(closedPaths[k], options);
            if (closedCoords.length < 3) continue;
            closeRingCoords(closedCoords);
            boundaries.push(closedCoords);
        }
        return boundaries;
    }

    // No edge paths and no prefixBoundary: only interior closed paths
    if (edges.length === 0) {
        for (var k = 0; k < closedPaths.length; k++) {
            if (!closedPaths[k] || closedPaths[k].length < 3) continue;
            var closedCoords = convertPathCoordinates(closedPaths[k], options);
            if (closedCoords.length < 3) continue;
            closeRingCoords(closedCoords);
            boundaries.push(closedCoords);
        }
        return boundaries;
    }

    // --- Connect edge paths into closed rings ---

    // Compute perimeter parameter for each edge path's start and end
    for (var i = 0; i < edges.length; i++) {
        edges[i].startT = perimeterParam(edges[i].coords[0], bounds, tol);
        edges[i].endT = perimeterParam(edges[i].coords[edges[i].coords.length - 1], bounds, tol);
    }

    // Sort edges by their start position on the perimeter (clockwise)
    edges.sort(function(a, b) { return a.startT - b.startT; });

    // Connect edge paths in clockwise order along the perimeter
    var visited = new Array(edges.length);
    for (var v = 0; v < visited.length; v++) visited[v] = false;

    for (var startIdx = 0; startIdx < edges.length; startIdx++) {
        if (visited[startIdx]) continue;

        var ring = [];
        visited[startIdx] = true;

        // Add this edge path's points
        for (var p = 0; p < edges[startIdx].coords.length; p++) {
            ring.push(edges[startIdx].coords[p]);
        }

        var currentEndPt = edges[startIdx].coords[edges[startIdx].coords.length - 1];
        var currentEndT = edges[startIdx].endT;
        var ringStartPt = edges[startIdx].coords[0];

        var maxSteps = edges.length + 1;

        for (var step = 0; step < maxSteps; step++) {
            // Check if ring can close (current end near ring start)
            if (step > 0 &&
                Math.abs(currentEndPt[0] - ringStartPt[0]) < tol &&
                Math.abs(currentEndPt[1] - ringStartPt[1]) < tol) {
                break;
            }

            // Find the unvisited edge with the closest start position
            // clockwise after currentEndT
            var nextIdx = -1;
            var bestDeltaT = Infinity;

            for (var ni = 0; ni < edges.length; ni++) {
                if (visited[ni]) continue;
                var st = edges[ni].startT;
                var deltaT = st - currentEndT;
                if (deltaT <= 1e-10) deltaT += 4;
                if (deltaT < bestDeltaT) {
                    bestDeltaT = deltaT;
                    nextIdx = ni;
                }
            }

            if (nextIdx === -1) {
                // No more edges — close the ring along the boundary
                appendBoundaryPath(ring, currentEndPt, ringStartPt, perimeter, bounds, tol);
                break;
            }

            var nextStartPt = edges[nextIdx].coords[0];

            // Add boundary path from current end to next edge's start (clockwise)
            appendBoundaryPath(ring, currentEndPt, nextStartPt, perimeter, bounds, tol);

            // Add next edge's points
            for (var p = 0; p < edges[nextIdx].coords.length; p++) {
                ring.push(edges[nextIdx].coords[p]);
            }

            currentEndPt = edges[nextIdx].coords[edges[nextIdx].coords.length - 1];
            currentEndT = edges[nextIdx].endT;
            visited[nextIdx] = true;
        }

        // Close the ring
        if (ring.length > 2) {
            closeRingCoords(ring);
            boundaries.push(ring);
        }
    }

    // Add interior closed paths as separate boundary rings
    for (var k = 0; k < closedPaths.length; k++) {
        if (!closedPaths[k] || closedPaths[k].length < 3) continue;
        var closedCoords = convertPathCoordinates(closedPaths[k], options);
        if (closedCoords.length < 3) continue;
        closeRingCoords(closedCoords);
        boundaries.push(closedCoords);
    }

    return boundaries;
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
