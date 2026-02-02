'use strict';

/**
 * GeoJSON export module for contour-core
 * Converts contour computation results to GeoJSON format
 *
 * Supports:
 * - LineString for line contours (lines mode)
 * - Polygon for filled contours (fill mode)
 */

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

    // Process each contour level
    for (var i = 0; i < result.paths.length; i++) {
        var pathInfo = result.paths[i];
        var level = result.levels[i];

        // Process paths (closed contours)
        if (pathInfo.paths) {
            for (var j = 0; j < pathInfo.paths.length; j++) {
                var path = pathInfo.paths[j];
                var coords = convertPathCoordinates(path, options);

                if (coords.length < 2) continue;

                // Apply bounds filter if provided
                if (bounds && !isPathInBounds(coords, bounds)) {
                    continue;
                }

                if (type === 'fill') {
                    // For fill mode, create Polygon
                    features.push({
                        type: 'Feature',
                        properties: createProperties(level, propertyName, 'polygon', i, j, true),
                        geometry: {
                            type: 'Polygon',
                            coordinates: [coords]
                        }
                    });
                } else {
                    // For lines mode, create LineString
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

        // Process edge paths (open contours at boundaries)
        if (includeEdgePaths && pathInfo.edgepaths) {
            for (var k = 0; k < pathInfo.edgepaths.length; k++) {
                var edgePath = pathInfo.edgepaths[k];
                var edgeCoords = convertPathCoordinates(edgePath, options);

                if (edgeCoords.length < 2) continue;

                // Apply bounds filter if provided
                if (bounds && !isPathInBounds(edgeCoords, bounds)) {
                    continue;
                }

                if (type === 'fill') {
                    // For fill mode, edge paths are handled in toFilledGeoJSON
                    // which properly closes them with boundaries
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

    // Group by level if not separateFeatures
    if (!separateFeatures && type === 'fill') {
        features = groupFeaturesByLevel(features, propertyName);
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
}

/**
 * Export filled contours as GeoJSON
 * This creates polygons that match the fill rendering in drawFilledPaths
 *
 * @param {Object} result - Result from computeContours()
 * @param {Object} options - Export options
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

    // Get data bounds for creating perimeter
    var dataBounds = getDataBounds(result);
    if (!dataBounds) {
        dataBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }

    // Create perimeter (boundary rectangle)
    var perimeter = createPerimeter(dataBounds);

    // Process each level from LOWEST to HIGHEST (matching drawFilledPaths order)
    for (var i = 0; i < paths.length; i++) {
        var pathInfo = paths[i];
        var level = levels[i];

        // Build complete polygon(s) for this level
        var polygons = buildLevelPolygons(pathInfo, perimeter, dataBounds, options);

        // Create feature for each polygon
        for (var j = 0; j < polygons.length; j++) {
            var poly = polygons[j];

            // Determine if this polygon has holes
            // (interior paths that should be holes)
            var hasHoles = poly.length > 1;

            features.push({
                type: 'Feature',
                properties: {
                    value: level,
                    level: level,
                    levelIndex: i,
                    type: 'filled_contour',
                    hasHoles: hasHoles,
                    polygonIndex: j
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: poly
                }
            });
        }
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
}

/**
 * Build polygons for a single contour level
 * Matches the logic in drawFilledPaths -> joinAllPaths
 *
 * @param {Object} pathInfo - Path info for a single level
 * @param {Array} perimeter - Boundary rectangle [[x0,y0], [x1,y0], [x1,y1], [x0,y1]]
 * @param {Object} bounds - Data bounds {minX, maxX, minY, maxY}
 * @param {Object} options - Export options
 * @returns {Array} Array of polygon coordinate arrays
 */
function buildLevelPolygons(pathInfo, perimeter, bounds, options) {
    var polygons = [];
    var edgepaths = pathInfo.edgepaths || [];
    var closedPaths = pathInfo.paths || [];

    // Helper functions to check if point is on a specific edge
    function isTop(pt) {
        return Math.abs(pt[1] - perimeter[0][1]) < 0.1;
    }
    function isBottom(pt) {
        return Math.abs(pt[1] - perimeter[2][1]) < 0.1;
    }
    function isLeft(pt) {
        return Math.abs(pt[0] - perimeter[0][0]) < 0.1;
    }
    function isRight(pt) {
        return Math.abs(pt[0] - perimeter[2][0]) < 0.1;
    }

    // Collect all paths to process
    var startIndices = [];
    for (var i = 0; i < edgepaths.length; i++) {
        if (edgepaths[i] && edgepaths[i].length > 0) {
            startIndices.push(i);
        }
    }

    // Join edge paths together with boundary connections
    var currentPoly = null;
    var startIdx = 0;
    var newLoop = true;

    if (pathInfo.prefixBoundary) {
        // Start with the full perimeter
        currentPoly = [
            [perimeter[0][0], perimeter[0][1]],
            [perimeter[1][0], perimeter[1][1]],
            [perimeter[2][0], perimeter[2][1]],
            [perimeter[3][0], perimeter[3][1]],
            [perimeter[0][0], perimeter[0][1]]  // Close the perimeter
        ];
    }

    // Process edge paths and connect them with boundary segments
    while (startIndices.length > 0) {
        var edgePath = edgepaths[startIndices[0]];
        if (!edgePath || edgePath.length === 0) {
            startIndices.shift();
            continue;
        }

        // Convert edge path to coordinates
        var edgeCoords = convertPathCoordinates(edgePath, options);

        // Add edge path to current polygon
        if (!currentPoly) {
            currentPoly = edgeCoords.slice();
        } else {
            // Find connection point and add boundary segment
            var lastPt = currentPoly[currentPoly.length - 1];
            var firstEdgePt = edgeCoords[0];

            // Add boundary corner(s) to connect
            addBoundaryConnection(currentPoly, lastPt, firstEdgePt, perimeter, isTop, isBottom, isLeft, isRight);
            currentPoly = currentPoly.concat(edgeCoords);
        }

        // Remove processed path
        startIndices.shift();

        // Check if edge path ends on boundary and needs continuation
        if (edgeCoords.length > 0) {
            var endPt = edgeCoords[edgeCoords.length - 1];
            var foundNext = false;

            // Try to find next path starting on same edge
            for (var cnt = 0; cnt < 4 && !foundNext; cnt++) {
                var nextCorner = getNextCorner(endPt, perimeter, isTop, isBottom, isLeft, isRight);
                var nextStartIdx = -1;

                // Find next path starting on this edge segment
                for (var j = 0; j < startIndices.length; j++) {
                    var nextPath = edgepaths[startIndices[j]];
                    if (!nextPath || nextPath.length === 0) continue;

                    var nextCoords = convertPathCoordinates(nextPath, options);
                    if (isOnEdgeSegment(nextCoords[0], endPt, nextCorner, isTop, isBottom, isLeft, isRight)) {
                        nextStartIdx = startIndices[j];
                        nextCorner = nextCoords[0];
                        break;
                    }
                }

                if (nextStartIdx >= 0) {
                    // Add corner to polygon
                    currentPoly.push([nextCorner[0], nextCorner[1]]);
                    endPt = nextCorner;
                    startIndices.splice(startIndices.indexOf(nextStartIdx), 1);
                    foundNext = true;
                } else {
                    // Add corner and continue around boundary
                    currentPoly.push([nextCorner[0], nextCorner[1]]);
                    endPt = nextCorner;
                }
            }
        }
    }

    // Close the polygon if needed
    if (currentPoly && currentPoly.length > 2) {
        if (pathInfo.prefixBoundary) {
            // Already closed at perimeter start
        } else {
            // Close back to start
            currentPoly.push([currentPoly[0][0], currentPoly[0][1]]);
        }
        polygons.push([currentPoly]);
    }

    // Add interior closed paths as separate polygons or holes
    // For GeoJSON, we treat them as separate polygons
    for (var k = 0; k < closedPaths.length; k++) {
        if (!closedPaths[k] || closedPaths[k].length < 3) continue;

        var closedCoords = convertPathCoordinates(closedPaths[k], options);
        // Close the polygon
        closedCoords.push([closedCoords[0][0], closedCoords[0][1]]);

        polygons.push([closedCoords]);
    }

    return polygons;
}

/**
 * Get the next corner point when traversing the boundary
 */
function getNextCorner(pt, perimeter, isTop, isBottom, isLeft, isRight) {
    if (isTop(pt) && !isRight(pt)) return perimeter[1];  // top -> top-right
    if (isLeft(pt)) return perimeter[0];                    // left -> top-left
    if (isBottom(pt)) return perimeter[3];                   // bottom -> bottom-left
    if (isRight(pt)) return perimeter[2];                    // right -> bottom-right
    return perimeter[0];
}

/**
 * Check if a point is on the edge segment from endPt to nextCorner
 */
function isOnEdgeSegment(pt, endPt, nextCorner, isTop, isBottom, isLeft, isRight) {
    // Same x coordinate (vertical edge)
    if (Math.abs(pt[0] - endPt[0]) < 0.1 && Math.abs(pt[0] - nextCorner[0]) < 0.1) {
        // Check if pt is between endPt and nextCorner (inclusive)
        var yMin = Math.min(endPt[1], nextCorner[1]);
        var yMax = Math.max(endPt[1], nextCorner[1]);
        return pt[1] >= yMin - 0.1 && pt[1] <= yMax + 0.1;
    }
    // Same y coordinate (horizontal edge)
    if (Math.abs(pt[1] - endPt[1]) < 0.1 && Math.abs(pt[1] - nextCorner[1]) < 0.1) {
        var xMin = Math.min(endPt[0], nextCorner[0]);
        var xMax = Math.max(endPt[0], nextCorner[0]);
        return pt[0] >= xMin - 0.1 && pt[0] <= xMax + 0.1;
    }
    return false;
}

/**
 * Add boundary connection between two points
 */
function addBoundaryConnection(poly, fromPt, toPt, perimeter, isTop, isBottom, isLeft, isRight) {
    if (!fromPt || !toPt) return;

    var currentPt = fromPt;

    // Move around boundary until we reach toPt
    for (var cnt = 0; cnt < 4 && (Math.abs(currentPt[0] - toPt[0]) > 0.1 || Math.abs(currentPt[1] - toPt[1]) > 0.1); cnt++) {
        var nextCorner;

        if (isTop(currentPt) && !isRight(currentPt)) nextCorner = perimeter[1];
        else if (isLeft(currentPt)) nextCorner = perimeter[0];
        else if (isBottom(currentPt)) nextCorner = perimeter[3];
        else if (isRight(currentPt)) nextCorner = perimeter[2];
        else break;

        // Check if toPt is on this edge segment
        if (isOnEdgeSegment(toPt, currentPt, nextCorner, isTop, isBottom, isLeft, isRight)) {
            poly.push([toPt[0], toPt[1]]);
            return;
        }

        poly.push([nextCorner[0], nextCorner[1]]);
        currentPt = nextCorner;
    }
}

/**
 * Create perimeter rectangle from data bounds
 */
function createPerimeter(bounds) {
    return [
        [bounds.minX, bounds.minY],  // bottom-left
        [bounds.maxX, bounds.minY],  // bottom-right
        [bounds.maxX, bounds.maxY],  // top-right
        [bounds.minX, bounds.maxY]   // top-left
    ];
}

/**
 * Get data bounds from contour result
 */
function getDataBounds(result) {
    if (!result.pathinfo || result.pathinfo.length === 0) {
        return null;
    }

    var pi = result.pathinfo[0];
    if (!pi.x || !pi.y) {
        return null;
    }

    var x = pi.x;
    var y = pi.y;

    return {
        minX: x[0],
        maxX: x[x.length - 1],
        minY: y[0],
        maxY: y[y.length - 1]
    };
}

/**
 * Convert path coordinates to GeoJSON format [x, y]
 * Preserves the original data coordinates
 */
function convertPathCoordinates(path, options) {
    var coords = [];

    for (var i = 0; i < path.length; i++) {
        var pt = path[i];
        if (Array.isArray(pt) && pt.length >= 2) {
            coords.push([pt[0], pt[1]]);
        }
    }

    return coords;
}

/**
 * Create properties object for a feature
 */
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

/**
 * Check if a path intersects with the given bounds
 */
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

/**
 * Group features by level value
 * Creates MultiLineString or MultiPolygon features
 */
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

/**
 * Export GeoJSON as a string
 */
function stringify(result, options) {
    var geojson = toGeoJSON(result, options);
    return JSON.stringify(geojson, null, options && options.indent || 2);
}

module.exports = {
    toGeoJSON: toGeoJSON,
    stringify: stringify,
    toFilledGeoJSON: toFilledGeoJSON
};
