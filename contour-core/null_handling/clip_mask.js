'use strict';

/**
 * Generate clip mask path for contour null regions
 * Based on plotly.js src/traces/contour/plot.js clipGaps function
 *
 * When connectgaps=false, instead of drawing rectangles over null areas,
 * we generate a smooth boundary path using marching squares algorithm.
 * This path is then used as a clipPath to hide contours in null regions.
 *
 * The key idea:
 * 1. Create a binary mask (valid data=1, null=0)
 * 2. Upsample the mask using bilinear interpolation (for smoother boundaries)
 * 3. Run marching squares at level=0.95 to find boundary
 * 4. Apply Catmull-Rom smoothing to the path
 * 5. Use as clipPath or mask in rendering
 *
 * Anti-aliasing strategy:
 * - Upsampling (2x) creates intermediate values at the boundary
 * - This allows marching squares to place boundary points at more precise locations
 * - Smoothing then creates smooth curves through these points
 */

var marchingSquares = require('../marchingsquares');
var pathFinding = require('../pathfinding');
var closeBoundaries = require('../close_boundaries');

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

// Default anti-aliasing options
var DEFAULT_UPSAMPLE_SCALE = 2;    // 2x upsampling
var DEFAULT_CLIP_LEVEL = 0.95;     // Higher level = boundary closer to data region
var DEFAULT_SMOOTHING = 0.3;       // Catmull-Rom smoothing factor
var DEFAULT_SIMPLIFY_TOLERANCE = 0.5; // Douglas-Peucker simplification tolerance

/**
 * Calculate perpendicular distance from a point to a line segment
 * @param {Array} point - Point [x, y]
 * @param {Array} lineStart - Line start point [x, y]
 * @param {Array} lineEnd - Line end point [x, y]
 * @returns {Number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    var dx = lineEnd[0] - lineStart[0];
    var dy = lineEnd[1] - lineStart[1];

    // Handle degenerate case where lineStart === lineEnd
    var lineLengthSquared = dx * dx + dy * dy;
    if (lineLengthSquared === 0) {
        // Point to point distance
        var ddx = point[0] - lineStart[0];
        var ddy = point[1] - lineStart[1];
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }

    // Calculate perpendicular distance
    var t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared;

    // Clamp t to [0, 1] to get distance to line segment (not infinite line)
    t = Math.max(0, Math.min(1, t));

    var closestX = lineStart[0] + t * dx;
    var closestY = lineStart[1] + t * dy;

    var distX = point[0] - closestX;
    var distY = point[1] - closestY;

    return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Douglas-Peucker path simplification algorithm
 * Reduces the number of points in a path while preserving its overall shape
 *
 * @param {Array} points - Array of [x, y] points
 * @param {Number} tolerance - Simplification tolerance (higher = fewer points)
 * @returns {Array} Simplified array of [x, y] points
 */
function simplifyPathDouglasPeucker(points, tolerance) {
    if (!points || points.length <= 2) return points;

    // Find the point with maximum distance from the line connecting first and last
    var maxDistance = 0;
    var maxIndex = 0;

    var first = points[0];
    var last = points[points.length - 1];

    for (var i = 1; i < points.length - 1; i++) {
        var distance = perpendicularDistance(points[i], first, last);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
        // Recursive call
        var left = simplifyPathDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
        var right = simplifyPathDouglasPeucker(points.slice(maxIndex), tolerance);

        // Concatenate results (avoid duplicating the middle point)
        return left.slice(0, -1).concat(right);
    } else {
        // All points between first and last can be removed
        return [first, last];
    }
}

/**
 * Simplify all paths in pathInfo using Douglas-Peucker algorithm
 * @param {Object} pathInfo - Path info from marching squares
 * @param {Number} tolerance - Simplification tolerance
 * @returns {Object} Path info with simplified paths
 */
function simplifyPaths(pathInfo, tolerance) {
    if (!pathInfo || tolerance <= 0) return pathInfo;

    var result = {
        level: pathInfo.level,
        crossings: pathInfo.crossings,
        smoothing: pathInfo.smoothing
    };

    // Simplify edge paths
    if (pathInfo.edgepaths && pathInfo.edgepaths.length > 0) {
        result.edgepaths = pathInfo.edgepaths.map(function(path) {
            return simplifyPathDouglasPeucker(path, tolerance);
        });
    } else {
        result.edgepaths = [];
    }

    // Simplify interior paths
    if (pathInfo.paths && pathInfo.paths.length > 0) {
        result.paths = pathInfo.paths.map(function(path) {
            return simplifyPathDouglasPeucker(path, tolerance);
        });
    } else {
        result.paths = [];
    }

    return result;
}
var DEFAULT_SIMPLIFY_TOLERANCE = 0.5; // Douglas-Peucker simplification tolerance

/**
 * Calculate perpendicular distance from point to line segment
 * @param {Array} point - Point [x, y]
 * @param {Array} lineStart - Line start point [x, y]
 * @param {Array} lineEnd - Line end point [x, y]
 * @returns {Number} Perpendicular distance
 */
function perpendicularDistance(point, lineStart, lineEnd) {
    var dx = lineEnd[0] - lineStart[0];
    var dy = lineEnd[1] - lineStart[1];

    // Handle case where start and end are the same point
    var lineLengthSquared = dx * dx + dy * dy;
    if (lineLengthSquared === 0) {
        return Math.sqrt(
            (point[0] - lineStart[0]) * (point[0] - lineStart[0]) +
            (point[1] - lineStart[1]) * (point[1] - lineStart[1])
        );
    }

    // Calculate perpendicular distance using cross product
    var t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lineLengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to line segment

    var nearestX = lineStart[0] + t * dx;
    var nearestY = lineStart[1] + t * dy;

    return Math.sqrt(
        (point[0] - nearestX) * (point[0] - nearestX) +
        (point[1] - nearestY) * (point[1] - nearestY)
    );
}

/**
 * Douglas-Peucker algorithm for path simplification
 * Reduces the number of points in a path while preserving its shape
 *
 * @param {Array} points - Array of [x, y] points
 * @param {Number} tolerance - Simplification tolerance (higher = more simplification)
 * @returns {Array} Simplified array of points
 */
function simplifyPathDouglasPeucker(points, tolerance) {
    if (!points || points.length <= 2) return points;

    tolerance = tolerance || DEFAULT_SIMPLIFY_TOLERANCE;
    if (tolerance <= 0) return points;

    // Find the point with maximum distance from line between first and last
    var maxDistance = 0;
    var maxIndex = 0;

    var first = points[0];
    var last = points[points.length - 1];

    for (var i = 1; i < points.length - 1; i++) {
        var distance = perpendicularDistance(points[i], first, last);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
        // Recursive call on both segments
        var left = simplifyPathDouglasPeucker(points.slice(0, maxIndex + 1), tolerance);
        var right = simplifyPathDouglasPeucker(points.slice(maxIndex), tolerance);

        // Concatenate results (avoiding duplicate point at maxIndex)
        return left.slice(0, -1).concat(right);
    }

    // All points between first and last are within tolerance
    return [first, last];
}

/**
 * Simplify all paths in pathInfo using Douglas-Peucker algorithm
 * @param {Object} pathInfo - Path info from marching squares
 * @param {Number} tolerance - Simplification tolerance
 */
function simplifyPathInfoPaths(pathInfo, tolerance) {
    if (tolerance <= 0) return;

    // Simplify edge paths
    if (pathInfo.edgepaths && pathInfo.edgepaths.length > 0) {
        for (var i = 0; i < pathInfo.edgepaths.length; i++) {
            if (pathInfo.edgepaths[i] && pathInfo.edgepaths[i].length > 2) {
                pathInfo.edgepaths[i] = simplifyPathDouglasPeucker(pathInfo.edgepaths[i], tolerance);
            }
        }
    }

    // Simplify interior paths
    if (pathInfo.paths && pathInfo.paths.length > 0) {
        for (var i = 0; i < pathInfo.paths.length; i++) {
            if (pathInfo.paths[i] && pathInfo.paths[i].length > 2) {
                pathInfo.paths[i] = simplifyPathDouglasPeucker(pathInfo.paths[i], tolerance);
            }
        }
    }
}

/**
 * Create a binary mask for clipping
 * Valid data points = 1, null/missing points = 0
 *
 * @param {Array} nullMask - Boolean mask from normalizeNullValues (true = null)
 * @returns {Array} Binary mask (1 = data, 0 = null)
 */
function makeBinaryMask(nullMask) {
    if (!nullMask) return null;

    var m = nullMask.length;
    var n = nullMask[0].length;
    var binaryMask = [];

    for (var i = 0; i < m; i++) {
        var row = [];
        for (var j = 0; j < n; j++) {
            // nullMask true means no data, so binary mask is 0
            // nullMask false means has data, so binary mask is 1
            row.push(nullMask[i][j] ? 0 : 1);
        }
        binaryMask.push(row);
    }

    return binaryMask;
}

/**
 * Bilinear interpolation for mask values
 * @param {Array} mask - 2D array of values
 * @param {Number} x - X coordinate (can be fractional)
 * @param {Number} y - Y coordinate (can be fractional)
 * @returns {Number} Interpolated value
 */
function bilinearInterpolate(mask, x, y) {
    var m = mask.length;
    var n = mask[0].length;

    // Clamp coordinates to valid range
    var x0 = Math.max(0, Math.min(Math.floor(x), n - 1));
    var y0 = Math.max(0, Math.min(Math.floor(y), m - 1));
    var x1 = Math.min(x0 + 1, n - 1);
    var y1 = Math.min(y0 + 1, m - 1);

    // Handle edge cases
    if (x0 === x1 && y0 === y1) return mask[y0][x0];
    if (x0 === x1) {
        var t = y - y0;
        return mask[y0][x0] * (1 - t) + mask[y1][x0] * t;
    }
    if (y0 === y1) {
        var t = x - x0;
        return mask[y0][x0] * (1 - t) + mask[y0][x1] * t;
    }

    // Bilinear interpolation
    var tx = x - x0;
    var ty = y - y0;

    var v00 = mask[y0][x0];
    var v10 = mask[y0][x1];
    var v01 = mask[y1][x0];
    var v11 = mask[y1][x1];

    // Interpolate along x for both rows
    var v0 = v00 * (1 - tx) + v10 * tx;
    var v1 = v01 * (1 - tx) + v11 * tx;

    // Interpolate along y
    return v0 * (1 - ty) + v1 * ty;
}

/**
 * Upsample a binary mask using bilinear interpolation
 * This creates intermediate values at the boundary between 0 and 1,
 * allowing marching squares to place boundary points at more precise locations.
 *
 * @param {Array} mask - 2D binary mask (values 0 or 1)
 * @param {Number} scale - Upsampling factor (e.g., 2 means 2x resolution)
 * @returns {Object} Object containing upsampled mask and scale factor
 */
function upsampleMask(mask, scale) {
    if (!mask || mask.length === 0) return { mask: mask, scale: 1 };

    scale = scale || DEFAULT_UPSAMPLE_SCALE;
    if (scale < 1) scale = 1;

    var m = mask.length;
    var n = mask[0].length;

    // For small masks or scale=1, no upsampling needed
    if (scale === 1) return { mask: mask, scale: 1 };

    var newM = (m - 1) * scale + 1;
    var newN = (n - 1) * scale + 1;
    var upsampled = [];

    for (var i = 0; i < newM; i++) {
        var row = [];
        var origY = i / scale;

        for (var j = 0; j < newN; j++) {
            var origX = j / scale;

            // Use bilinear interpolation for smooth transitions
            var value = bilinearInterpolate(mask, origX, origY);

            // Clamp to [0, 1] range
            row.push(Math.max(0, Math.min(1, value)));
        }
        upsampled.push(row);
    }

    return { mask: upsampled, scale: scale };
}

/**
 * Generate clip path for null regions using marching squares
 * Now with direct boundary smoothing instead of upsampling
 *
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} options - Options including width, height, padding
 * @param {Boolean} options.useDataCoordinates - If true, return path in data coordinates (for interactive mode)
 * @param {Array} options.dataX - Optional real X coordinate array (for useDataCoordinates mode)
 * @param {Array} options.dataY - Optional real Y coordinate array (for useDataCoordinates mode)
 * @param {Number} options.clipLevel - Level for marching squares (default: 0.95)
 * @param {Number} options.clipSmoothing - Smoothing factor (default: 0.3, set to 0 to disable)
 * @param {String} options.smoothingMethod - 'upsample' or 'direct' (default: 'direct')
 * @returns {String} SVG path data string for the clip region
 */
function generateClipPath(contourResult, options) {
    options = options || {};

    var nullMask = contourResult.nullMask;
    if (!nullMask || contourResult.nullCount === 0) {
        return null; // No null regions, no clipping needed
    }

    var binaryMask = makeBinaryMask(nullMask);
    if (!binaryMask) return null;

    var originalM = binaryMask.length;
    var originalN = binaryMask[0].length;

    // Get anti-aliasing options
    var clipLevel = options.clipLevel !== undefined ? options.clipLevel : DEFAULT_CLIP_LEVEL;
    var clipSmoothing = options.clipSmoothing !== undefined ? options.clipSmoothing : DEFAULT_SMOOTHING;
    var smoothingMethod = options.smoothingMethod || 'direct';  // 'direct' or 'upsample'

    var workingMask, scale, m, n;

    if (smoothingMethod === 'upsample') {
        // Legacy method: Upsample the mask for smoother boundaries
        var upsampleScale = options.upsampleScale !== undefined ? options.upsampleScale : DEFAULT_UPSAMPLE_SCALE;
        var upsampled = upsampleMask(binaryMask, upsampleScale);
        workingMask = upsampled.mask;
        scale = upsampled.scale;
        m = workingMask.length;
        n = workingMask[0].length;
    } else {
        // New method: Use original mask directly, apply smoothing to boundary points later
        workingMask = binaryMask;
        scale = 1;
        m = originalM;
        n = originalN;
    }

    // Create x and y coordinate arrays in the upsampled coordinate space
    // The coordinates are scaled to match the original coordinate range
    var x, y;
    if (options.useDataCoordinates && options.dataX && options.dataY) {
        // For data coordinates, we need to create a finer grid
        var dataX = options.dataX;
        var dataY = options.dataY;
        var xMin = Math.min.apply(Math, dataX);
        var xMax = Math.max.apply(Math, dataX);
        var yMin = Math.min.apply(Math, dataY);
        var yMax = Math.max.apply(Math, dataY);

        // Create upsampled coordinate arrays
        x = [];
        y = [];
        for (var i = 0; i < n; i++) {
            // Map upsampled index to original index, then to data coordinate
            var origIdx = i / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;

            if (origIdxFloor >= dataX.length - 1) {
                x.push(dataX[dataX.length - 1]);
            } else if (origIdxFloor < 0) {
                x.push(dataX[0]);
            } else {
                // Linear interpolation between data coordinates
                x.push(dataX[origIdxFloor] + (dataX[origIdxFloor + 1] - dataX[origIdxFloor]) * origIdxFrac);
            }
        }
        for (var j = 0; j < m; j++) {
            var origIdx = j / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;

            if (origIdxFloor >= dataY.length - 1) {
                y.push(dataY[dataY.length - 1]);
            } else if (origIdxFloor < 0) {
                y.push(dataY[0]);
            } else {
                y.push(dataY[origIdxFloor] + (dataY[origIdxFloor + 1] - dataY[origIdxFloor]) * origIdxFrac);
            }
        }
    } else {
        // Use index coordinates scaled to upsampled space
        x = [];
        y = [];
        for (var i = 0; i < n; i++) x.push(i / scale);
        for (var j = 0; j < m; j++) y.push(j / scale);
    }

    // Create pathinfo for clip path generation
    // level = 0.95 means we draw boundary at 95% between null (0) and data (1)
    // This is more conservative and reduces the risk of clipping valid data
    var clipPathInfo = {
        level: clipLevel,
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        z: workingMask,
        x: x,
        y: y,
        smoothing: clipSmoothing
    };

    // Run marching squares to find boundary
    marchingSquares.makeCrossings([clipPathInfo]);

    // Calculate tolerance based on coordinate range
    // Use relative tolerance for small data ranges (like GPS coordinates)
    var xRange = x.length > 1 ? (x[x.length - 1] - x[0]) : 1;
    var yRange = y.length > 1 ? (y[y.length - 1] - y[0]) : 1;
    // Scale tolerance for upsampled grid
    var xTol = Math.max(1e-10, xRange * 0.001 / scale);
    var yTol = Math.max(1e-10, yRange * 0.001 / scale);

    pathFinding.findAllPaths([clipPathInfo], xTol, yTol);

    // Close boundaries
    closeBoundaries([clipPathInfo], { type: 'levels' });

    // Apply Douglas-Peucker path simplification if tolerance > 0
    var simplifyTolerance = options.simplifyTolerance !== undefined ? options.simplifyTolerance : DEFAULT_SIMPLIFY_TOLERANCE;
    if (simplifyTolerance > 0) {
        // Calculate a reasonable tolerance based on coordinate range
        var xRange = x.length > 1 ? (x[x.length - 1] - x[0]) : 1;
        var yRange = y.length > 1 ? (y[y.length - 1] - y[0]) : 1;
        var baseTol = Math.min(xRange, yRange) / Math.max(m, n) * 2;

        // Scale tolerance for upsampled grids
        var scaledTolerance = baseTol * simplifyTolerance;
        simplifyPathInfoPaths(clipPathInfo, scaledTolerance);
    }

    // For interactive mode, return path in data coordinates
    // The renderer will convert to canvas coordinates based on visibleRange
    if (options.useDataCoordinates) {
        return createClipPathDataCoords(clipPathInfo, m, n);
    }

    // For static mode, convert to canvas coordinates
    var width = options.width || 500;
    var height = options.height || 400;
    var padding = normalizePadding(options.padding, 30);
    return createClipPathSVG(clipPathInfo, width, height, padding, originalM, originalN);
}

/**
 * Create clip path in data coordinates (for interactive mode)
 * The clip path defines the VISIBLE region (valid data area, not null area)
 *
 * Strategy:
 * Marching squares at level=0.9 on binary mask (data=1, null=0) traces the
 * boundary where value crosses 0.9. This traces the DATA region boundary.
 *
 * We use these paths DIRECTLY as the clip path (without outer boundary).
 * With regular clip (nonzero rule), points inside the data boundary are shown,
 * points outside are hidden.
 *
 * NOTE: We do NOT use evenodd here because we're not adding an outer boundary.
 * The marching squares paths alone define the visible (data) region.
 *
 * @private
 */
function createClipPathDataCoords(clipPathInfo, m, n) {
    // Get coordinate arrays from pathInfo
    var x = clipPathInfo.x || [];
    var y = clipPathInfo.y || [];

    // Perimeter in data coordinates for boundary detection
    // Use the actual data coordinates from x and y arrays
    var xMin = x.length > 0 ? Math.min.apply(Math, x) : 0;
    var xMax = x.length > 0 ? Math.max.apply(Math, x) : n - 1;
    var yMin = y.length > 0 ? Math.min.apply(Math, y) : 0;
    var yMax = y.length > 0 ? Math.max.apply(Math, y) : m - 1;

    // Calculate tolerance based on data range
    var xRange = xMax - xMin || 1;
    var yRange = yMax - yMin || 1;
    var tol = Math.max(1e-10, Math.min(xRange, yRange) * 0.001);

    var perimeter = [
        [xMin, yMax],       // top-left
        [xMax, yMax],       // top-right
        [xMax, yMin],       // bottom-right
        [xMin, yMin]        // bottom-left
    ];

    // Get the paths from marching squares - these trace the DATA region boundary
    // Use them directly as the clip path (no outer boundary, no evenodd needed)
    var dataPaths = joinAllPathsDataCoords(clipPathInfo, perimeter, tol, false);

    // Return just the data paths - they define the visible region
    return dataPaths || '';
}

/**
 * Join all paths in data coordinates (no scaling)
 * @param {Object} pathInfo - Path info from marching squares
 * @param {Array} perimeter - Perimeter points in data coordinates
 * @param {Number} tol - Tolerance for boundary detection
 * @param {Boolean} reverseWinding - If true, reverse path winding for evenodd rule
 * @private
 */
function joinAllPathsDataCoords(pathInfo, perimeter, tol, reverseWinding) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths || [];

    if (edgepaths.length === 0 && (!pathInfo.paths || pathInfo.paths.length === 0)) {
        return '';
    }

    function istop(pt) { return pt && Math.abs(pt[1] - perimeter[0][1]) < tol; }
    function isbottom(pt) { return pt && Math.abs(pt[1] - perimeter[2][1]) < tol; }
    function isleft(pt) { return pt && Math.abs(pt[0] - perimeter[0][0]) < tol; }
    function isright(pt) { return pt && Math.abs(pt[0] - perimeter[2][0]) < tol; }

    function pathToSVGStr(path, isClosed) {
        if (!path || path.length === 0) return '';

        // Reverse winding if needed (for evenodd rule)
        var orderedPath = reverseWinding ? path.slice().reverse() : path;

        var d = 'M ' + orderedPath[0][0] + ' ' + orderedPath[0][1];
        for (var i = 1; i < orderedPath.length; i++) {
            d += ' L ' + orderedPath[i][0] + ' ' + orderedPath[i][1];
        }
        if (isClosed) d += ' Z';
        return d;
    }

    // Process edge paths
    var startsleft = edgepaths.map(function(v, idx) { return idx; });
    var i = 0;
    var newloop = true;
    var endpt, newendpt, nexti, addpath;

    while (startsleft.length > 0) {
        addpath = pathToSVGStr(edgepaths[i], false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        // When reversed, we start from the "end" of the original path
        endpt = reverseWinding ? edgepaths[i][0] : edgepaths[i][edgepaths[i].length - 1];
        nexti = -1;

        for (var cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
            else if (isleft(endpt)) newendpt = perimeter[0];
            else if (isbottom(endpt)) newendpt = perimeter[3];
            else if (isright(endpt)) newendpt = perimeter[2];

            for (var possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                // When reversed, we look for the "end" of the next path (which is the start when not reversed)
                var ptNew = reverseWinding ? edgepaths[possiblei][edgepaths[possiblei].length - 1] : edgepaths[possiblei][0];
                if (Math.abs(endpt[0] - newendpt[0]) < tol) {
                    if (Math.abs(endpt[0] - ptNew[0]) < tol &&
                        (ptNew[1] - endpt[1]) * (newendpt[1] - ptNew[1]) >= 0) {
                        newendpt = ptNew;
                        nexti = possiblei;
                    }
                } else if (Math.abs(endpt[1] - newendpt[1]) < tol) {
                    if (Math.abs(endpt[1] - ptNew[1]) < tol &&
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
    if (pathInfo.paths) {
        for (i = 0; i < pathInfo.paths.length; i++) {
            fullpath += pathToSVGStr(pathInfo.paths[i], true);
        }
    }

    return fullpath;
}

/**
 * Convert path array to SVG path string
 * @param {Array} path - Array of [x, y] points
 * @param {Boolean} isClosed - Whether path is closed
 * @returns {String} SVG path data string
 */
function pathToSVG(path, isClosed) {
    if (!path || path.length === 0) return '';

    var d = 'M ' + path[0][0] + ' ' + path[0][1];
    for (var i = 1; i < path.length; i++) {
        d += ' L ' + path[i][0] + ' ' + path[i][1];
    }
    if (isClosed) {
        d += ' Z';
    }
    return d;
}

/**
 * Convert clip pathinfo to SVG path data
 * The clip path defines the VISIBLE region (valid data area, not null area)
 *
 * @param {Object} clipPathInfo - Pathinfo from marching squares
 * @param {Number} width - Canvas/SVG width
 * @param {Number} height - Canvas/SVG height
 * @param {Object} padding - Padding object { top, right, bottom, left }
 * @param {Number} m - Number of rows
 * @param {Number} n - Number of columns
 * @returns {String} SVG path data string
 */
function createClipPathSVG(clipPathInfo, width, height, padding, m, n) {
    var perimeter = createPerimeter(width, height, padding);
    var scaleX = (width - padding.left - padding.right) / (n - 1);
    var scaleY = (height - padding.top - padding.bottom) / (m - 1);

    // Scale path from grid space to canvas space
    function scalePath(path) {
        return path.map(function(pt) {
            return [
                padding.left + pt[0] * scaleX,
                padding.top + (m - 1 - pt[1]) * scaleY
            ];
        });
    }

    // Build the complete path string
    // The clip path should only contain the valid data region
    // We don't include the boundary rectangle because:
    // 1. The valid data region is already within the boundary
    // 2. Using evenodd rule with two same-direction paths would create wrong effect
    var joinedPaths = joinAllPaths(clipPathInfo, perimeter, scalePath, pathToSVG);

    // Return only the joined paths (valid data region)
    // The connecting boundary segments are already included by joinAllPaths
    return joinedPaths;
}

/**
 * Create perimeter path for boundary closing
 */
function createPerimeter(width, height, padding) {
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
 * Join all edge paths into a single path with proper boundary connections
 * Based on plotly.js joinAllPaths function
 * @param {Object} pathInfo - Pathinfo from marching squares
 * @param {Array} perimeter - Perimeter points
 * @param {Function} scalePath - Function to scale path coordinates
 * @param {Function} pathToSVGFn - Function to convert path to SVG string
 * @returns {String} Joined path string
 */
function joinAllPaths(pathInfo, perimeter, scalePath, pathToSVGFn) {
    var fullpath = '';
    var edgepaths = pathInfo.edgepaths;

    if (edgepaths.length === 0 && pathInfo.paths.length === 0) {
        return '';
    }

    var i = 0;
    var startsleft = edgepaths.map(function(v, idx) { return idx; });
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
        var scaledPath = scalePath(edgepaths[i]);
        addpath = pathToSVGFn(scaledPath, false);
        fullpath += newloop ? addpath : addpath.replace(/^M/, 'L');
        startsleft.splice(startsleft.indexOf(i), 1);

        endpt = scaledPath[scaledPath.length - 1];
        nexti = -1;

        // Loop through sides to find next path
        for (cnt = 0; cnt < 4; cnt++) {
            if (!endpt) break;

            // Determine which corner to move to
            if (istop(endpt) && !isright(endpt)) newendpt = perimeter[1];
            else if (isleft(endpt)) newendpt = perimeter[0];
            else if (isbottom(endpt)) newendpt = perimeter[3];
            else if (isright(endpt)) newendpt = perimeter[2];

            // Find next path that starts on this edge
            for (possiblei = 0; possiblei < edgepaths.length; possiblei++) {
                var ptNew = scalePath(edgepaths[possiblei])[0];

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
        var scaledPath = scalePath(pathInfo.paths[i]);
        fullpath += pathToSVGFn(scaledPath, true);
    }

    return fullpath;
}

/**
 * Generate null mask polygons in data coordinates.
 * Returns structured polygon data suitable for GeoJSON export or canvas rendering.
 *
 * Uses the same marching-squares pipeline as generateClipPath, but instead of
 * returning an SVG path string, returns arrays of polygon rings (exterior + holes).
 *
 * Each polygon represents a contiguous region of valid data (non-null).
 * When rendered with evenodd fill rule, null areas appear as holes.
 *
 * @param {Object} contourResult - Result from computeContours()
 * @param {Object} options - Options
 * @param {Array} options.dataX - X coordinate array (from pathinfo[0].x)
 * @param {Array} options.dataY - Y coordinate array (from pathinfo[0].y)
 * @param {Number} options.clipLevel - Marching squares level (default: 0.95)
 * @param {Number} options.clipSmoothing - Smoothing factor (default: 0.3)
 * @param {Number} options.simplifyTolerance - Douglas-Peucker tolerance (default: 0.5)
 * @returns {Object|null} { regions: [{ exterior: [[x,y],...], holes: [[[x,y],...],...] }], bounds: {minX, maxX, minY, maxY} }
 *   Returns null if no null regions exist.
 */
function generateNullMaskPolygons(contourResult, options) {
    options = options || {};

    var nullMask = contourResult.nullMask;
    if (!nullMask || contourResult.nullCount === 0) {
        return null;
    }

    var binaryMask = makeBinaryMask(nullMask);
    if (!binaryMask) return null;

    var originalM = binaryMask.length;
    var originalN = binaryMask[0].length;

    var clipLevel = options.clipLevel !== undefined ? options.clipLevel : DEFAULT_CLIP_LEVEL;
    var clipSmoothing = options.clipSmoothing !== undefined ? options.clipSmoothing : DEFAULT_SMOOTHING;
    var smoothingMethod = options.smoothingMethod || 'direct';

    var workingMask, scale, m, n;

    if (smoothingMethod === 'upsample') {
        var upsampleScale = options.upsampleScale !== undefined ? options.upsampleScale : DEFAULT_UPSAMPLE_SCALE;
        var upsampled = upsampleMask(binaryMask, upsampleScale);
        workingMask = upsampled.mask;
        scale = upsampled.scale;
        m = workingMask.length;
        n = workingMask[0].length;
    } else {
        workingMask = binaryMask;
        scale = 1;
        m = originalM;
        n = originalN;
    }

    var clipPathInfo = {
        level: clipLevel,
        crossings: {},
        starts: [],
        edgepaths: [],
        paths: [],
        z: workingMask,
        x: [],
        y: [],
        smoothing: clipSmoothing
    };

    var dataX = options.dataX || (contourResult.pathinfo && contourResult.pathinfo[0] ? contourResult.pathinfo[0].x : null);
    var dataY = options.dataY || (contourResult.pathinfo && contourResult.pathinfo[0] ? contourResult.pathinfo[0].y : null);

    if (dataX && dataY) {
        for (var i = 0; i < n; i++) {
            var origIdx = i / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;
            if (origIdxFloor >= dataX.length - 1) {
                clipPathInfo.x.push(dataX[dataX.length - 1]);
            } else if (origIdxFloor < 0) {
                clipPathInfo.x.push(dataX[0]);
            } else {
                clipPathInfo.x.push(dataX[origIdxFloor] + (dataX[origIdxFloor + 1] - dataX[origIdxFloor]) * origIdxFrac);
            }
        }
        for (var j = 0; j < m; j++) {
            var origIdx = j / scale;
            var origIdxFloor = Math.floor(origIdx);
            var origIdxFrac = origIdx - origIdxFloor;
            if (origIdxFloor >= dataY.length - 1) {
                clipPathInfo.y.push(dataY[dataY.length - 1]);
            } else if (origIdxFloor < 0) {
                clipPathInfo.y.push(dataY[0]);
            } else {
                clipPathInfo.y.push(dataY[origIdxFloor] + (dataY[origIdxFloor + 1] - dataY[origIdxFloor]) * origIdxFrac);
            }
        }
    } else {
        for (var i = 0; i < n; i++) clipPathInfo.x.push(i / scale);
        for (var j = 0; j < m; j++) clipPathInfo.y.push(j / scale);
    }

    marchingSquares.makeCrossings([clipPathInfo]);

    var xRange = clipPathInfo.x.length > 1 ? (clipPathInfo.x[clipPathInfo.x.length - 1] - clipPathInfo.x[0]) : 1;
    var yRange = clipPathInfo.y.length > 1 ? (clipPathInfo.y[clipPathInfo.y.length - 1] - clipPathInfo.y[0]) : 1;
    var xTol = Math.max(1e-10, xRange * 0.001 / scale);
    var yTol = Math.max(1e-10, yRange * 0.001 / scale);

    pathFinding.findAllPaths([clipPathInfo], xTol, yTol);
    closeBoundaries([clipPathInfo], { type: 'levels' });

    var simplifyTolerance = options.simplifyTolerance !== undefined ? options.simplifyTolerance : DEFAULT_SIMPLIFY_TOLERANCE;
    if (simplifyTolerance > 0) {
        var baseTol = Math.min(xRange, yRange) / Math.max(m, n) * 2;
        var scaledTolerance = baseTol * simplifyTolerance;
        simplifyPathInfoPaths(clipPathInfo, scaledTolerance);
    }

    var minX = clipPathInfo.x[0];
    var maxX = clipPathInfo.x[clipPathInfo.x.length - 1];
    var minY = clipPathInfo.y[0];
    var maxY = clipPathInfo.y[clipPathInfo.y.length - 1];
    var bounds = { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
    var tol = Math.max(1e-10, Math.max(xRange, yRange) * 0.001);
    var perimeter = [minX, minY, maxX, maxY, minX, maxY];

    var regions = buildMaskRegions(clipPathInfo, perimeter, bounds, tol);

    return {
        regions: regions,
        bounds: bounds
    };
}

/**
 * Build closed polygon regions from clip path info.
 * Connects edge paths along the boundary to form closed rings,
 * then assigns interior closed paths as holes or separate regions.
 */
function buildMaskRegions(pathInfo, perimeter, bounds, tol) {
    var regions = [];
    var edgepaths = pathInfo.edgepaths || [];
    var closedPaths = pathInfo.paths || [];

    if (edgepaths.length === 0 && pathInfo.prefixBoundary) {
        var exterior = [
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX, bounds.maxY],
            [bounds.minX, bounds.maxY],
            [bounds.minX, bounds.minY]
        ];
        var holes = [];
        for (var k = 0; k < closedPaths.length; k++) {
            if (closedPaths[k] && closedPaths[k].length >= 3) {
                holes.push(closeRingArray(copyCoords(closedPaths[k])));
            }
        }
        regions.push({ exterior: exterior, holes: holes });
        return regions;
    }

    if (edgepaths.length === 0) {
        for (var k = 0; k < closedPaths.length; k++) {
            if (closedPaths[k] && closedPaths[k].length >= 3) {
                regions.push({
                    exterior: closeRingArray(copyCoords(closedPaths[k])),
                    holes: []
                });
            }
        }
        return regions;
    }

    for (var i = 0; i < edgepaths.length; i++) {
        edgepaths[i].startT = perimeterParam(edgepaths[i][0], bounds, tol);
        edgepaths[i].endT = perimeterParam(edgepaths[i][edgepaths[i].length - 1], bounds, tol);
    }

    var visited = new Array(edgepaths.length);
    for (var v = 0; v < visited.length; v++) visited[v] = false;

    for (var startIdx = 0; startIdx < edgepaths.length; startIdx++) {
        if (visited[startIdx]) continue;

        var ring = copyCoords(edgepaths[startIdx]);
        visited[startIdx] = true;

        var currentEndPt = edgepaths[startIdx][edgepaths[startIdx].length - 1];
        var currentEndT = edgepaths[startIdx].endT;
        var ringStartPt = edgepaths[startIdx][0];
        var ringStartT = edgepaths[startIdx].startT;

        var maxSteps = edgepaths.length + 1;

        for (var step = 0; step < maxSteps; step++) {
            if (step > 0 &&
                Math.abs(currentEndPt[0] - ringStartPt[0]) < tol &&
                Math.abs(currentEndPt[1] - ringStartPt[1]) < tol) {
                break;
            }

            var nextIdx = -1;
            var bestDeltaT = Infinity;

            for (var ni = 0; ni < edgepaths.length; ni++) {
                if (visited[ni]) continue;
                var st = edgepaths[ni].startT;
                var deltaT = st - currentEndT;
                if (deltaT <= 1e-10) deltaT += 4;
                if (deltaT < bestDeltaT) {
                    bestDeltaT = deltaT;
                    nextIdx = ni;
                }
            }

            if (nextIdx === -1) {
                appendBoundaryToArray(ring, currentEndPt, ringStartPt, perimeter, bounds, tol);
                break;
            }

            var nextStartPt = edgepaths[nextIdx][0];
            appendBoundaryToArray(ring, currentEndPt, nextStartPt, perimeter, bounds, tol);

            for (var p = 0; p < edgepaths[nextIdx].length; p++) {
                ring.push([edgepaths[nextIdx][p][0], edgepaths[nextIdx][p][1]]);
            }

            currentEndPt = edgepaths[nextIdx][edgepaths[nextIdx].length - 1];
            currentEndT = edgepaths[nextIdx].endT;
            visited[nextIdx] = true;
        }

        if (ring.length > 2) {
            ring = closeRingArray(ring);
            regions.push({ exterior: ring, holes: [] });
        }
    }

    for (var k = 0; k < closedPaths.length; k++) {
        if (!closedPaths[k] || closedPaths[k].length < 3) continue;
        var closedCoords = copyCoords(closedPaths[k]);
        closedCoords = closeRingArray(closedCoords);
        regions.push({ exterior: closedCoords, holes: [] });
    }

    return regions;
}

function perimeterParam(pt, bounds, tol) {
    var x = pt[0], y = pt[1];
    var minX = bounds.minX, maxX = bounds.maxX;
    var minY = bounds.minY, maxY = bounds.maxY;
    var rangeX = maxX - minX || 1;
    var rangeY = maxY - minY || 1;

    var onBottom = Math.abs(y - minY) < tol && x >= minX - tol && x <= maxX + tol;
    var onRight = Math.abs(x - maxX) < tol && y >= minY - tol && y <= maxY + tol;
    var onTop = Math.abs(y - maxY) < tol && x >= minX - tol && x <= maxX + tol;
    var onLeft = Math.abs(x - minX) < tol && y >= minY - tol && y <= maxY + tol;

    if (onBottom && !onRight) return (x - minX) / rangeX;
    if (onRight && !onTop) return 1 + (y - minY) / rangeY;
    if (onTop && !onLeft) return 2 + (maxX - x) / rangeX;
    if (onLeft && !onBottom) return 3 + (maxY - y) / rangeY;

    if (onBottom && onRight) return 1;
    if (onRight && onTop) return 2;
    if (onTop && onLeft) return 3;
    if (onLeft && onBottom) return 0;

    return -1;
}

function appendBoundaryToArray(ring, fromPt, toPt, perimeter, bounds, tol) {
    if (Math.abs(fromPt[0] - toPt[0]) < tol && Math.abs(fromPt[1] - toPt[1]) < tol) {
        return;
    }

    var fromT = perimeterParam(fromPt, bounds, tol);
    var toT = perimeterParam(toPt, bounds, tol);

    var deltaT = toT - fromT;
    if (deltaT <= 1e-10) deltaT += 4;

    var corners = [
        [bounds.minX, bounds.minY],
        [bounds.maxX, bounds.minY],
        [bounds.maxX, bounds.maxY],
        [bounds.minX, bounds.maxY]
    ];

    var cornersToAdd = [];
    for (var ci = 0; ci < 4; ci++) {
        var cornerT = ci;
        var distToCorner = cornerT - fromT;
        if (distToCorner <= 1e-10) distToCorner += 4;
        if (distToCorner > 1e-10 && distToCorner < deltaT - 1e-10) {
            cornersToAdd.push({ index: ci, dist: distToCorner });
        }
    }

    cornersToAdd.sort(function(a, b) { return a.dist - b.dist; });

    for (var i = 0; i < cornersToAdd.length; i++) {
        var ci = cornersToAdd[i].index;
        var last = ring[ring.length - 1];
        if (!last || Math.abs(corners[ci][0] - last[0]) > tol || Math.abs(corners[ci][1] - last[1]) > tol) {
            ring.push([corners[ci][0], corners[ci][1]]);
        }
    }

    var last = ring[ring.length - 1];
    if (!last || Math.abs(toPt[0] - last[0]) > tol || Math.abs(toPt[1] - last[1]) > tol) {
        ring.push([toPt[0], toPt[1]]);
    }
}

function copyCoords(path) {
    var result = [];
    for (var i = 0; i < path.length; i++) {
        result.push([path[i][0], path[i][1]]);
    }
    return result;
}

function closeRingArray(coords) {
    if (coords.length < 3) return coords;
    var first = coords[0];
    var last = coords[coords.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-10 || Math.abs(first[1] - last[1]) > 1e-10) {
        coords.push([first[0], first[1]]);
    } else {
        coords[coords.length - 1] = [first[0], first[1]];
    }
    return coords;
}

module.exports = {
    generateClipPath: generateClipPath,
    generateNullMaskPolygons: generateNullMaskPolygons,
    makeBinaryMask: makeBinaryMask,
    upsampleMask: upsampleMask,
    bilinearInterpolate: bilinearInterpolate,
    createClipPathSVG: createClipPathSVG,
    DEFAULT_UPSAMPLE_SCALE: DEFAULT_UPSAMPLE_SCALE,
    DEFAULT_CLIP_LEVEL: DEFAULT_CLIP_LEVEL,
    DEFAULT_SMOOTHING: DEFAULT_SMOOTHING
};
