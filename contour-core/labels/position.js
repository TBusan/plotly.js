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
 */
function getTextLocation(path, totalPathLen, positionOnPath, textWidth) {
    var halfWidth = textWidth / 2;
    var p0 = getPointAtLength(path, Math.max(0, positionOnPath - halfWidth));
    var p1 = getPointAtLength(path, Math.min(totalPathLen, positionOnPath + halfWidth));
    var pCenter = getPointAtLength(path, positionOnPath);

    // Calculate angle
    var theta = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    // Center the text at 2/3 of the center position plus 1/3 the p0/p1 midpoint
    var x = (pCenter.x * 4 + p0.x + p1.x) / 6;
    var y = (pCenter.y * 4 + p0.y + p1.y) / 6;

    return { x: x, y: y, theta: theta };
}

/**
 * Find optimal position for a label along a path
 * @param {Array} path - Array of [x, y] points
 * @param {Object} textOpts - Text options {level, width, height}
 * @param {Array} existingLabels - Array of existing labels to avoid overlap
 * @param {Object} plotBounds - Plot boundaries {left, right, top, bottom, center, middle}
 * @returns {Object} Label position with {x, y, theta, level}
 */
function findBestTextLocation(path, textOpts, existingLabels, plotBounds) {
    if (!path || path.length < 2) {
        return null;
    }

    existingLabels = existingLabels || [];
    plotBounds = plotBounds || {};

    var textWidth = textOpts.width || 50;
    var totalPathLen = pathLength(path);

    // Calculate search range
    var dp, p0, pMax;
    if (totalPathLen > textWidth * 2) {
        // Open path - keep text away from edges
        dp = (totalPathLen - textWidth) / (COST_CONSTANTS.INITIALSEARCHPOINTS + 1);
        p0 = dp + textWidth / 2;
        pMax = totalPathLen - textWidth / 2 - dp;
    } else {
        // Closed or very short path
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
            var newLocation = getTextLocation(path, totalPathLen, p, textWidth);
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
        if (j > 0) dp /= 2;
        p0 = pMin - dp / 2;
        pMax = pMin + dp / 2;
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
