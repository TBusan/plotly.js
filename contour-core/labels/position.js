'use strict';

/**
 * Find best text location along a contour path
 * Complete implementation based on Plotly's algorithm
 */

var locationCost = require('./cost');

// Cost optimization constants
var COST_CONSTANTS = {
    EDGECOST: 1,
    ANGLECOST: 1,
    NEIGHBORCOST: 5,
    SAMELEVELFACTOR: 10,
    SAMELEVELDISTANCE: 5,
    MAXCOST: 100,
    INITIALSEARCHPOINTS: 10,
    ITERATIONS: 5
};

// Location cache for performance optimization
var workingPath = null;
var workingTextWidth = 0;
var locationCache = {};

/**
 * Modulo operation that handles negative numbers correctly
 * @param {number} n - The number to modulo
 * @param {number} m - The modulus
 * @returns {number} Result in [0, m)
 */
function mod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * Calculate path length from array of points
 */
function pathLength(path) {
    var len = 0;
    for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
}

/**
 * Get point at a specific distance along the path
 */
function getPointAtLength(path, targetLen) {
    var accumulated = 0;
    for (var i = 1; i < path.length; i++) {
        var dx = path[i][0] - path[i - 1][0];
        var dy = path[i][1] - path[i - 1][1];
        var segLen = Math.sqrt(dx * dx + dy * dy);

        if (accumulated + segLen >= targetLen) {
            var t = (targetLen - accumulated) / segLen;
            return {
                x: path[i - 1][0] + dx * t,
                y: path[i - 1][1] + dy * t
            };
        }
        accumulated += segLen;
    }
    return { x: path[path.length - 1][0], y: path[path.length - 1][1] };
}

/**
 * Get text location at a specific position along the path
 * Similar to Plotly's Lib.getTextLocation but works with point arrays
 * Now supports closed paths with wraparound using mod operation
 * @param {Array} path - Array of [x, y] points
 * @param {number} totalPathLen - Total path length
 * @param {number} positionOnPath - Position along path for text center
 * @param {number} textWidth - Width of text
 * @param {boolean} isClosed - Whether this is a closed path (default: false)
 * @returns {Object} Location with {x, y, theta}
 */
function getTextLocation(path, totalPathLen, positionOnPath, textWidth, isClosed) {
    // Use short-term cache for performance
    if (path !== workingPath || textWidth !== workingTextWidth) {
        locationCache = {};
        workingPath = path;
        workingTextWidth = textWidth;
    }

    // Use position as cache key (with appropriate precision)
    var cacheKey = Math.round(positionOnPath * 100) / 100;
    if (locationCache[cacheKey] !== undefined) {
        return locationCache[cacheKey];
    }

    var halfWidth = textWidth / 2;
    var p0Pos, p1Pos;

    if (isClosed) {
        // For closed paths, use mod operation for wraparound
        p0Pos = mod(positionOnPath - halfWidth, totalPathLen);
        p1Pos = mod(positionOnPath + halfWidth, totalPathLen);
    } else {
        // For open paths, clamp to path bounds
        p0Pos = Math.max(0, positionOnPath - halfWidth);
        p1Pos = Math.min(totalPathLen, positionOnPath + halfWidth);
    }

    var p0 = getPointAtLength(path, p0Pos);
    var p1 = getPointAtLength(path, p1Pos);
    var pCenter = getPointAtLength(path, positionOnPath);

    // Calculate angle from text width endpoints (tangent direction)
    var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    // Center the text at 2/3 of the center position plus 1/3 the p0/p1 midpoint
    // This assumes the path segment is roughly a quadratic curve
    var x = (pCenter.x * 4 + p0.x + p1.x) / 6;
    var y = (pCenter.y * 4 + p0.y + p1.y) / 6;

    var result = { x: x, y: y, theta: theta };
    locationCache[cacheKey] = result;
    return result;
}

/**
 * Find optimal position for a label along a path
 * @param {Array} path - Array of [x, y] points
 * @param {Object} textOpts - Text options {level, width, height}
 * @param {Array} existingLabels - Array of existing labels to avoid overlap
 * @param {Object} plotBounds - Plot boundaries {left, right, top, bottom, center, middle}
 * @param {boolean} isClosed - Whether this is a closed path (default: auto-detect)
 * @returns {Object} Label position with {x, y, theta, level}
 */
function findBestTextLocation(path, textOpts, existingLabels, plotBounds, isClosed) {
    if (!path || path.length < 2) {
        return null;
    }

    existingLabels = existingLabels || [];
    plotBounds = plotBounds || {};

    var textWidth = textOpts.width || 50;
    var totalPathLen = pathLength(path);

    // Auto-detect closed path if not specified
    // A path is considered closed if start and end points are very close
    if (isClosed === undefined) {
        var startPt = path[0];
        var endPt = path[path.length - 1];
        var dx = endPt[0] - startPt[0];
        var dy = endPt[1] - startPt[1];
        var closureDist = Math.sqrt(dx * dx + dy * dy);
        isClosed = closureDist < 1; // Consider closed if within 1 unit
    }

    // Calculate search range
    var dp, p0, pMax;

    if (isClosed) {
        // Closed path - can search anywhere along the path
        dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
        p0 = dp / 2;
        pMax = totalPathLen;
    } else if (totalPathLen > textWidth * 2) {
        // Open path - keep text away from edges
        dp = (totalPathLen - textWidth * 2) / (COST_CONSTANTS.INITIALSEARCHPOINTS - 1);
        p0 = textWidth;
        pMax = totalPathLen - textWidth;
    } else {
        // Very short path - search entire path
        dp = totalPathLen / COST_CONSTANTS.INITIALSEARCHPOINTS;
        p0 = dp / 2;
        pMax = totalPathLen;
    }

    var bestCost = Infinity;
    var bestLoc = null;
    var pMin = p0;

    // Iterative search for best position
    for (var j = 0; j < COST_CONSTANTS.ITERATIONS; j++) {
        for (var p = p0; p < pMax; p += dp) {
            var newLocation = getTextLocation(path, totalPathLen, p, textWidth, isClosed);
            var newCost = locationCost(newLocation, {
                width: textWidth,
                height: textOpts.height || 20,
                level: textOpts.level || 0
            }, existingLabels, plotBounds);

            if (newCost < bestCost) {
                bestCost = newCost;
                bestLoc = newLocation;
                pMin = p;
            }
        }

        if (bestCost > COST_CONSTANTS.MAXCOST * 2) break;

        // Refine search around best location
        // FIXED: Changed from dp/2 to dp*1.5 for adequate search range
        if (j > 0) dp /= 2;
        p0 = pMin - dp / 2;
        pMax = pMin + dp * 1.5;
    }

    if (bestCost <= COST_CONSTANTS.MAXCOST) {
        bestLoc.level = textOpts.level || 0;
        return bestLoc;
    }

    // Fallback: return middle of path
    var midIdx = Math.floor(path.length / 2);
    var pt = path[midIdx];
    var nextPt = path[Math.min(midIdx + 1, path.length - 1)];
    var theta = 0;
    if (nextPt && pt) {
        theta = Math.atan2(nextPt[1] - pt[1], nextPt[0] - pt[0]);
    }
    return {
        x: pt ? pt[0] : 0,
        y: pt ? pt[1] : 0,
        theta: theta,
        level: textOpts.level || 0
    };
}

module.exports = findBestTextLocation;
